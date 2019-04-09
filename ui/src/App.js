import React, { Component } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { getFreshToken, configureConnector, decodeToken } from './services/tc-auth';
import loadingImg from './loading.gif';
import './App.css';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import 'react-day-picker/lib/style.css';
import API from './services/API';
import _ from 'lodash';
import config from './config/config';
import moment from 'moment';
import logo from './logo.png';
import Modal from './Modal';

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
      isLoggedIn: false,
      currentUser: null
    };

    this.handleDayChange = this.handleDayChange.bind(this);
    this.viewTopicMessages = this.viewTopicMessages.bind(this);
    this.getTopicMessages = this.getTopicMessages.bind(this);
    this.filter = this.filter.bind(this);
    this.clearFilters = this.clearFilters.bind(this);
    this.applyFilters = this.applyFilters.bind(this);
    this.changeExtraMsgCount = this.changeExtraMsgCount.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.setupWS = this.setupWS.bind(this);
    this.toggleMsgModal = this.toggleMsgModal.bind(this);
    this.isAuthorized = this.isAuthorized.bind(this);
    configureConnector({
      connectorUrl: config.ACCOUNTS_APP_CONNECTOR,
      frameId: 'tc-accounts-iframe',
    });
  }

  isAuthorized(user) {
    const roles = user.roles || [];
    let allowed = false;
    for (let i = 0; i < roles.length && !allowed; i += 1) {
      for (let j = 0; j < config.ROLES.length && !allowed; j += 1) {
        if (roles[i].trim().toLowerCase() === config.ROLES[j].trim().toLowerCase()) allowed = true;
      }
    }
    return allowed;
  }

  authenticate(callback) {
    const that = this;
    return getFreshToken().then((token) => {
      that.token = token;
      const user = decodeToken(token);
      that.setState({
        currentUser: user,
        isLoggedIn: true,
      });
      if (that.isAuthorized(user)) {
        return callback();
      }
    }).catch(() => {
      let url = `retUrl=${encodeURIComponent(config.APP_URL)}`;
      url = `${config.TC_AUTH_URL}/member?${url}`;
      location.href = url; // eslint-disable-line no-restricted-globals
      return ({});
    });
  }

  logout() {
    const url = `${config.TC_AUTH_URL}/#!/logout?retUrl=${encodeURIComponent(config.APP_URL)}`
    location.href = url; // eslint-disable-line no-restricted-globals
  }

  setupWS() {
    const that = this;
    // initialize web socket
    const ws = new WebSocket(config.WS_URL);
    let terminated = false;
    that.ws = ws;
    that.wsOpened = false;
    ws.onopen = () => {
      // send token to server
      ws.send('token:' + that.token);
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
      let messages;
      if (msgJSON.topic !== that.state.selectedTopic) return;
      if (msgJSON.full) {
        messages = msgJSON.messages.reverse();
        that.setState({ messages, loading: false });
      } else {
        messages = msgJSON.messages.concat(that.state.messages);
        const maxCount = defaultMsgCount + that.state.extraMsgCount;
        if (messages.length > maxCount) messages = messages.slice(0, maxCount);
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
    this.setState({
      loading: true,
    });
    this.authenticate(() => {
      // get topics
      API.getAllTopics(that.token, (err, topics) => {
        if (err) {
          that.setState({
            errorMsg: err,
            loading: false,
          });
        } else {
          that.setState({
            topics,
            loading: false,
          });
        }
      });

      that.setupWS();
    });
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

    if (this.state.loading) {
      return;
    }

    this.setState({ loading: true, errorMsg: null });
    const that = this;
    API.sendMessageToKafka(this.token, this.state.selectedTopic, this.state.messageToSend, (err) => {
      if (err) {
        that.setState({ loading: false, errorMsg: err });
      } else {
        that.setState({ loading: false, messageToSend: '' });
      }
    });
  }

  handleKeyPress(e) {
    if (e.key === 'Enter') {
      this.sendMessage();
    }
  }

  toggleMsgModal(msg) {
    if (msg) {
      if (msg.payload) {
        this.setState({
          selectedMsg: msg
        })
      }
    } else {
      this.setState({
        selectedMsg: null
      })
    }
  }

  render() {
    const { topics, tempOriginator, tempPayload, tempMimetype, tempStartDate, tempEndDate,
      messageToSend, extraMsgCount, errorMsg, loading, selectedTopic, selectedMsg } = this.state;
    const filteredMessages = this.filter();
    if (!this.state.isLoggedIn) {
      return (
        <div className="app">
          {loading && <div className="loading-img-container">
            <img src={loadingImg} className="loading-img" alt="Loading..." />
          </div>}
          <div className="cols">
            <div className="left-nav">
              <div className="logo">
                <img src={logo} alt="logo" />
              </div>
            </div>
          </div>
        </div>
      )
    }
    // check authorization
    if (!this.isAuthorized(this.state.currentUser)) {
      return (
        <div className="app">
          <div className="cols">
            <div className="left-nav">
              <div className="logo">
                <img src={logo} alt="logo" />
              </div>
            </div>
            <div className="main-content">
              <div className="logged-in-user">
                <div className="content">
                  <p><span>Welcome, {this.state.currentUser.handle}</span></p>
                  <a onClick={this.logout}>Logout</a>
                </div>
              </div>
              <div className="page-body">
                <h4>You do not have access to use this application.</h4>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <Router>
        <div className="app">
          {loading && <div className="loading-img-container">
            <img src={loadingImg} className="loading-img" alt="Loading..." />
          </div>}
          <div className="cols">
            <div className="left-nav">
              <div className="logo">
                <img src={logo} alt="logo" />
              </div>
              <div className="left-nav-item">
                Topic:<br />
                <select className="form-control topic-select" onChange={(e) => this.setState({ tempTopic: e.target.value })}>
                  <option value="">Please Select a Topic</option>
                  {_.map(topics, (tp, index) => (<option key={index}>{tp}</option>))}
                </select>
                <button className="btn btn-primary view-button" onClick={this.viewTopicMessages}>View</button>
              </div>
              <div className="left-nav-item filter">
                <h6>Filters</h6>
              </div>
              <div className="left-nav-item">
                Originator:<br />
                <input className="form-control filter-control" value={tempOriginator || ''}
                  onChange={(e) => this.setState({ tempOriginator: e.target.value })} />
              </div>
              <div className="left-nav-item">
                Payload:<br />
                <input className="form-control filter-control" value={tempPayload || ''}
                  onChange={(e) => this.setState({ tempPayload: e.target.value })} />
              </div>
              <div className="left-nav-item">
                Mime-Type:<br />
                <input className="form-control filter-control" value={tempMimetype || ''}
                  onChange={(e) => this.setState({ tempMimetype: e.target.value })} />
              </div>
              <div className="left-nav-item">
                Timestamp Start:<br />
                <div className="timestamp-control">
                  <DayPickerInput value={tempStartDate || undefined}
                    onDayChange={(day) => this.handleDayChange('start', day)} className="form-control" />
                </div>
              </div>
              <div className="left-nav-item">
                Timestamp End:<br />
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
                Specify Additional Offset (Offset of 20 already applied. This will get added to it.)<br />
                <input type="number" className="form-control filter-control extra-message-count" value={extraMsgCount}
                  onChange={(e) => this.changeExtraMsgCount(Number(e.target.value))} />
                <button className="btn btn-primary get-button" onClick={this.getTopicMessages}>Get</button>
              </div>
            </div>
            <div className="main-content">
              <div className="logged-in-user">
                <div className="content">
                  <p><span>Welcome, {this.state.currentUser.handle}</span></p>
                  <a onClick={this.logout}>Logout</a>
                </div>
              </div>
              <div className="page-heading">
                Topic{selectedTopic ? (<span>: <span className="selected-topic">{selectedTopic}</span></span>) : ''}
              </div>
              <div className="page-body">
                {errorMsg && <div className="error-msg">
                  {errorMsg}
                </div>}
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Originator</th>
                        <th>Payload</th>
                        <th>Timestamp</th>
                        <th>Mime-Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {_.map(filteredMessages, (msg, ind) => (
                        <tr key={ind}>
                          <td>{msg.originator || ''}</td>
                          <td onClick={() => this.toggleMsgModal(msg)}>{msg.payload ? JSON.stringify(msg.payload) : ''}</td>
                          <td>{msg.timestamp || ''}</td>
                          <td>{msg['mime-type'] || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="msg-input-group">
                  <input
                    className="message-input form-control"
                    value={messageToSend || ''}
                    placeholder="Send message in selected topic"
                    onChange={(e) => this.setState({ messageToSend: e.target.value })}
                    onKeyPress={this.handleKeyPress}
                  />
                  <button className="btn btn-primary send-message-button" onClick={this.sendMessage}>Send Message</button>
                </div>
              </div>
            </div>
          </div>
          {
            selectedMsg &&
            <Modal message={selectedMsg} onClose={() => this.toggleMsgModal()} />
          }
        </div>
      </Router>
    );
  }
}

export default App;
