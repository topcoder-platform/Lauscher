import React, { Component } from 'react';
import logo from './logo.png';
import loadingImg from './loading.gif';
import './App.css';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import 'react-day-picker/lib/style.css';
import API from './services/API';
import _ from 'lodash';
import config from './config/config';
import moment from 'moment';

const defaultMsgCount = Number(config.DEFAULT_MESSAGE_COUNT);

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      // all topics
      topics: [],
      // temp selected topic
      tempTopic: null,
      // selected topic
      selectedTopic: null,

      // temp filters
      tempOriginator: null,
      tempPayload: null,
      tempMimetype: null,
      tempStartDate: null,
      tempEndDate: null,
      // applied filters
      originator: null,
      payload: null,
      mimetype: null,
      startDate: null,
      endDate: null,
      // messages of the selected topic
      messages: [],

      // message to send to Kafka
      messageToSend: null,
      // extra message count
      extraMsgCount: 0,
      // error message
      errorMsg: null,
      // whether loading
      loading: false,
    };

    this.handleDayChange = this.handleDayChange.bind(this);
    this.viewTopicMessages = this.viewTopicMessages.bind(this);
    this.getTopicMessages = this.getTopicMessages.bind(this);
    this.filter = this.filter.bind(this);
    this.clearFilters = this.clearFilters.bind(this);
    this.applyFilters = this.applyFilters.bind(this);
    this.changeExtraMsgCount = this.changeExtraMsgCount.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.setupWS = this.setupWS.bind(this);
  }

  setupWS() {
    const that = this;
    // initialize web socket
    const ws = new WebSocket(config.WS_URL);
    let terminated = false;
    that.ws = ws;
    that.wsOpened = false;
    ws.onopen = () => {
      that.wsOpened = true;
      if (that.selectedTopic) {
        // the topic was selected, but ws was not opened yet, so the message was not sent to server,
        // and thus we send it here now
        ws.send(JSON.stringify({ topic: that.selectedTopic, count: defaultMsgCount + that.state.extraMsgCount }));
        that.selectedTopic = null;
      }
    };
    ws.onmessage = (event) => {
      const msgJSON = JSON.parse(event.data);
      if (msgJSON.topic !== that.state.selectedTopic) return;
      if (msgJSON.full) {
        that.setState({ messages: msgJSON.messages, loading: false });
      } else {
        let messages = that.state.messages.concat(msgJSON.messages);
        const maxCount = defaultMsgCount + that.state.extraMsgCount;
        if (messages.length > maxCount) messages = messages.slice(messages.length - maxCount);
        that.setState({ messages });
      }
    };
    const terminateAndReconnect = () => {
      if (terminated) return;
      ws.close();
      that.wsOpened = false;
      that.selectedTopic = null;
      terminated = true;
      // when the web page is closed, the web socket will be closed too,
      // in such case, we don't need to re-connect to server,
      // so we wait for a while, if the page is not closed yet, then we re-connect to server
      setTimeout(that.setupWS, 1000);
    };
    ws.onerror = terminateAndReconnect;
    ws.onclose = terminateAndReconnect;
  }

  componentDidMount() {
    const that = this;
    // get topics
    API.getAllTopics((err, topics) => {
      if (err) {
        that.setState({ errorMsg: err });
      } else {
        that.setState({ topics });
      }
    });

    that.setupWS();
  }

  handleDayChange(type, day) {
    const d = new Date(`${moment(day).format('YYYY-MM-DD')} 00:00:00`);
    if (type === 'start') {
      this.setState({ tempStartDate: d });
    } else {
      this.setState({ tempEndDate: d });
    }
  }

  viewTopicMessages() {
    if (!this.state.tempTopic || this.state.tempTopic.length === 0) {
      this.setState({ errorMsg: 'Please select topic to view.' });
      return;
    }
    const selectedTopic = this.state.tempTopic;
    this.setState({
      selectedTopic,
      // clear data
      tempOriginator: null,
      tempPayload: null,
      tempMimetype: null,
      tempStartDate: null,
      tempEndDate: null,
      originator: null,
      payload: null,
      mimetype: null,
      startDate: null,
      endDate: null,
      messages: [],
      messageToSend: null,
      errorMsg: null,
      loading: true,
    });

    // send selected topic and total msg count via web socket
    if (this.wsOpened) {
      // web socket is opened, then send it
      this.selectedTopic = null;
      this.ws.send(JSON.stringify({ topic: selectedTopic, count: defaultMsgCount + this.state.extraMsgCount }));
    } else {
      // web socket is not opened yet, then set it to this.selectedTopic so that the ws.onopen will send it
      this.selectedTopic = selectedTopic;
    }
  }

  getTopicMessages() {
    if (!this.state.selectedTopic || this.state.selectedTopic.length === 0) {
      this.setState({ errorMsg: 'Please select topic to view.' });
      return;
    }
    this.setState({
      messages: [],
      errorMsg: null,
      loading: true,
    });

    // send selected topic and total max count via web socket
    if (this.wsOpened) {
      // web socket is opened, then send it
      this.selectedTopic = null;
      this.ws.send(JSON.stringify({ topic: this.state.selectedTopic, count: defaultMsgCount + this.state.extraMsgCount }));
    } else {
      // web socket is not opened yet, then set it to this.selectedTopic so that the ws.onopen will send it
      this.selectedTopic = this.state.selectedTopic;
    }
  }

  filter() {
    const { originator, payload, mimetype, startDate, endDate, messages } = this.state;
    const msgs = _.map(messages, (msgStr) => {
      try {
        return JSON.parse(msgStr);
      } catch (e) {
        // invalid message JSON is considered as raw payload
        return { payload: msgStr };
      }
    });
    return _.filter(msgs, (msg) => {
      if (originator && originator.length > 0 &&
        (!msg.originator || msg.originator.toLowerCase().indexOf(originator.toLowerCase()) < 0)) return false;
      if (payload && payload.length > 0 &&
        (!msg.payload || JSON.stringify(msg.payload).toLowerCase().indexOf(payload.toLowerCase()) < 0)) return false;
      if (mimetype && mimetype.length > 0 &&
        (!msg['mime-type'] || msg['mime-type'].toLowerCase().indexOf(mimetype.toLowerCase()) < 0)) return false;
      let timestamp = null;
      if (msg.timestamp && msg.timestamp.length > 0) timestamp = new Date(msg.timestamp);
      if (startDate && (!timestamp || startDate > timestamp)) return false;
      if (endDate) {
        if (!timestamp) return false;
        // calculate end of day of endDate
        const eod = new Date();
        eod.setTime(endDate.getTime() + 1000 * 60 * 60 * 24 - 1);
        if (timestamp > eod) return false;
      }
      return true;
    });
  }

  clearFilters() {
    this.setState({
      tempOriginator: null,
      tempPayload: null,
      tempMimetype: null,
      tempStartDate: null,
      tempEndDate: null,
      originator: null,
      payload: null,
      mimetype: null,
      startDate: null,
      endDate: null,
      errorMsg: null,
    });
  }

  applyFilters() {
    if (!this.state.selectedTopic || this.state.selectedTopic.length === 0) {
      this.setState({ errorMsg: 'Please select topic to view.' });
      return;
    }

    const { tempOriginator, tempPayload, tempMimetype, tempStartDate, tempEndDate } = this.state;
    if (tempStartDate && tempEndDate && tempStartDate > tempEndDate) {
      this.setState({ errorMsg: 'Timestamp start date must not be later than end date.' });
      return;
    }
    this.setState({
      originator: tempOriginator,
      payload: tempPayload,
      mimetype: tempMimetype,
      startDate: tempStartDate,
      endDate: tempEndDate,
      errorMsg: null,
    });
  }

  changeExtraMsgCount(count) {
    if (count < 0) count = 0;
    count = Math.floor(count);
    this.setState({ extraMsgCount: count });
  }

  sendMessage() {
    if (!this.state.messageToSend || this.state.messageToSend.length === 0) {
      this.setState({ errorMsg: 'Message can not be empty.' });
      return;
    }
    if (!this.state.selectedTopic) {
      this.setState({ errorMsg: 'Please select topic to view.' });
      return;
    }

    this.setState({ loading: true, errorMsg: null });
    const that = this;
    API.sendMessageToKafka(this.state.selectedTopic, this.state.messageToSend, (err) => {
      if (err) {
        that.setState({ loading: false, errorMsg: err });
      } else {
        that.setState({ loading: false });
      }
    });
  }

  render() {
    const { topics, tempOriginator, tempPayload, tempMimetype, tempStartDate, tempEndDate,
      messageToSend, extraMsgCount, errorMsg, loading } = this.state;
    const filteredMessages = this.filter();

    return (
      <div className="app">
        { loading && <div className="loading-img-container">
          <img src={loadingImg} className="loading-img" alt="Loading..." />
        </div> }
        <div className="row">
          <div className="left-nav">
            <img src={logo} className="logo" alt="logo" />
            <div className="left-nav-item">
              Topic:<br/>
              <select className="form-control topic-select" onChange={(e) => this.setState({ tempTopic: e.target.value })}>
                <option value="">Please Select a Topic</option>
                { _.map(topics, (tp, index) => (<option key={index}>{tp}</option>)) }
              </select>
              <button className="btn btn-primary view-button" onClick={this.viewTopicMessages}>View</button>
            </div>
            <div className="left-nav-item filter">
              <h6>Filters</h6>
            </div>
            <div className="left-nav-item">
              Originator:<br/>
              <input className="form-control filter-control" value={tempOriginator || ''}
                onChange={(e) => this.setState({ tempOriginator: e.target.value })}></input>
            </div>
            <div className="left-nav-item">
              Payload:<br/>
              <input className="form-control filter-control" value={tempPayload || ''}
                onChange={(e) => this.setState({ tempPayload: e.target.value })}></input>
            </div>
            <div className="left-nav-item">
              Mime-Type:<br/>
              <input className="form-control filter-control" value={tempMimetype || ''}
                onChange={(e) => this.setState({ tempMimetype: e.target.value })}></input>
            </div>
            <div className="left-nav-item">
              Timestamp Start:<br/>
              <div className="timestamp-control">
                <DayPickerInput value={tempStartDate || undefined}
                  onDayChange={(day) => this.handleDayChange('start', day)} />
              </div>
            </div>
            <div className="left-nav-item">
              Timestamp End:<br/>
              <div className="timestamp-control">
                <DayPickerInput value={tempEndDate || undefined}
                  onDayChange={(day) => this.handleDayChange('end', day)} />
              </div>
            </div>
            <div className="left-nav-item">
              <button className="btn btn-primary" onClick={this.clearFilters}>Clear</button>
              <button className="btn btn-primary apply-button" onClick={this.applyFilters}>Apply</button>
            </div>
            <div className="left-nav-item">
              Specify Additional Offset (Offset of 20 already applied. This will get added to it.)<br/>
              <input type="number" className="form-control filter-control extra-message-count" value={extraMsgCount}
                onChange={(e) => this.changeExtraMsgCount(Number(e.target.value))}></input>
              <button className="btn btn-primary get-button" onClick={this.getTopicMessages}>Get</button>
            </div>
          </div>
          <div className="main-content">
            { errorMsg && <div className="error-msg">
              {errorMsg}
            </div>}
            <table className="table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Originator</th>
                  <th>Payload</th>
                  <th>Timestamp</th>
                  <th>Mime-Type</th>
                </tr>
              </thead>
              <tbody>
                { _.map(filteredMessages, (msg, ind) => (
                <tr key={ind}>
                  <td>{msg.topic || ''}</td>
                  <td>{msg.originator || ''}</td>
                  <td>{msg.payload ? JSON.stringify(msg.payload) : ''}</td>
                  <td>{msg.timestamp || ''}</td>
                  <td>{msg['mime-type'] || ''}</td>
                </tr>
                  )) }
              </tbody>
            </table>
            <br/>
            Send message in selected topic:<br/>
            <textarea className="message-input" rows="5" value={messageToSend || ''}
              onChange={(e) => this.setState({ messageToSend: e.target.value })}></textarea>
            <button className="btn btn-primary send-message-button" onClick={this.sendMessage}>Send Message</button>
          </div>
        </div>

      </div>
    );
  }
}

export default App;
