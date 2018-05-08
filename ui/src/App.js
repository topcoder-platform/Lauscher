import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import 'react-day-picker/lib/style.css';
import API from './services/API';
import _ from 'lodash';
import config from './config/config';
import moment from 'moment';

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

      // filters
      topic: null,
      originator: null,
      payload: null,
      mimetype: null,
      startDate: null,
      endDate: null,
      // all messages got from web socket
      messages: [],

      // message to send to Kafka
      messageToSend: null,
    };

    this.handleDayChange = this.handleDayChange.bind(this);
    this.viewTopicMessages = this.viewTopicMessages.bind(this);
    this.filter = this.filter.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
  }

  componentDidMount() {
    const that = this;
    // get topics
    API.getAllTopics((topics) => that.setState({ topics }));

    // initialize web socket
    const ws = new WebSocket(config.WS_URL);
    that.ws = ws;
    ws.onopen = () => {
      that.wsOpened = true;
      if (that.selectedTopic) {
        ws.send(`topic:${that.selectedTopic}`);
      }
    };
    ws.onmessage = (event) => {
      const messages = that.state.messages;
      messages.push(event.data);
      that.setState({ messages });
    };
  }

  handleDayChange(type, day) {
    const d = new Date(`${moment(day).format('YYYY-MM-DD')} 00:00:00`);
    if (type === 'start') {
      this.setState({ startDate: d });
    } else {
      this.setState({ endDate: d });
    }
  }

  viewTopicMessages() {
    if (!this.state.tempTopic || this.state.tempTopic.length === 0) {
      alert('Please select topic.');
      return;
    }
    const selectedTopic = this.state.tempTopic;
    this.setState({
      selectedTopic,
      // clear data
      topic: null,
      originator: null,
      payload: null,
      mimetype: null,
      startDate: null,
      endDate: null,
      messages: [],
      messageToSend: null,
    });

    // send selected topic via web socket
    if (this.wsOpened) {
      // web socket is opened, then directly send the message
      this.ws.send(`topic:${selectedTopic}`);
    } else {
      // web socket is not opened yet, then set it to this.selectedTopic so that the ws.onopen will send it
      this.selectedTopic = selectedTopic;
    }
  }

  filter() {
    const { topic, originator, payload, mimetype, startDate, endDate, messages } = this.state;
    if (startDate && endDate && startDate > endDate) {
      alert('Timestamp start date must not be later than end date.');
      return [];
    }
    const msgs = _.map(messages, (msgStr) => {
      try {
        return JSON.parse(msgStr);
      } catch (e) {
        // invalid message JSON is considered as raw payload
        return { payload: msgStr };
      }
    });
    return _.filter(msgs, (msg) => {
      if (topic && topic.length > 0 &&
        (!msg.topic || msg.topic.toLowerCase().indexOf(topic.toLowerCase()) < 0)) return false;
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

  sendMessage() {
    if (!this.state.messageToSend || this.state.messageToSend.length === 0) {
      alert('Message can not be empty.');
      return;
    }
    API.sendMessageToKafka(this.state.selectedTopic, this.state.messageToSend, () => {
      alert('Message is successfully sent.');
    });
  }

  render() {
    const { topics, selectedTopic, topic, originator, payload, mimetype, startDate, endDate, messageToSend } = this.state;
    const filteredMessages = this.filter();

    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Topcoder Data Stream UI</h1>
        </header>
        <div className="App-item">
          Topic:
          <select className="form-control topic-select" onChange={(e) => this.setState({ tempTopic: e.target.value })}>
            <option value="">Please select</option>
            { _.map(topics, (tp, index) => (<option key={index}>{tp}</option>)) }
          </select>
          <button className="btn btn-primary" onClick={this.viewTopicMessages}>View Topic Messages</button>
        </div>
        { selectedTopic && <div>
          <div className="App-item">
            <h3>Filters:</h3>
          </div>
          <div className="App-item">
            <div className="label">Topic:</div> <input className="form-control filter" value={topic || ''}
              onChange={(e) => this.setState({ topic: e.target.value })}></input>
            <div className="label">Originator:</div> <input className="form-control filter" value={originator || ''}
              onChange={(e) => this.setState({ originator: e.target.value })}></input>
          </div>
          <div className="App-item">
            <div className="label">Payload:</div> <input className="form-control filter" value={payload || ''}
              onChange={(e) => this.setState({ payload: e.target.value })}></input>
            <div className="label">Mime-Type:</div> <input className="form-control filter" value={mimetype || ''}
              onChange={(e) => this.setState({ mimetype: e.target.value })}></input>
          </div>
          <div className="App-item">
            <div className="label">Timestamp Start:</div> <DayPickerInput value={startDate || ''}
              onDayChange={(day) => this.handleDayChange('start', day)} />
            <div className="label">Timestamp End:</div> <DayPickerInput value={endDate || ''}
              onDayChange={(day) => this.handleDayChange('end', day)} />
          </div>
          <br/>
          <div className="App-item">
            <h3>Topic messages:</h3>
          </div>
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
          <div className="App-item">
            <button className="btn btn-primary" onClick={this.sendMessage}>Send Message To Selected Topic</button>
          </div>
          <div className="App-item">
            <textarea className="form-control" rows="5" value={messageToSend || ''}
              onChange={(e) => this.setState({ messageToSend: e.target.value })}></textarea>
          </div>
        </div> }
      </div>
    );
  }
}

export default App;
