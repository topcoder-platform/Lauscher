/**
 * Data stream web socket functionalities.
 */
'use strict';

const _ = require('lodash');
const logger = require('./common/logger');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const helper = require('./common/helper');
const config = require('config');

// all web socket client data
const allWS = [];

// all cached messages, key is topic, value is array of messages of the topic
const allMessages = {};

// max cache message count per topic
const maxMsgCount = Number(config.MAX_MESSAGE_COUNT);

// send data to client via web socket
const sendData = (ws, payload) => {
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    logger.error(err);
  }
};

/**
 * Setup web socket.
 */
const setup = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    logger.debug('web socket connected');
    const id = helper.generateRandomString();
    const clientData = {
      id,
      topic: null,
      ws,
      authorized: false,
    };
    allWS.push(clientData);

    // got message from client,
    // the message is 'token:{JWT-token}' or string representation of JSON containing fields: topic and count,
    // where count is the last count of messages of the topic to retrieve
    ws.on('message', (message) => {
      logger.debug(`web socket message: ${message}`);
      // handle token
      if (message.startsWith('token:')) {
        const token = message.substring('token:'.length);
        helper.isTokenAuthorized(token, (err, isAuthorized) => {
          if (err) {
            logger.error('failed to authorize token', err);
          } else if (isAuthorized) {
            clientData.authorized = true;
          }
        });
        return;
      }

      let msgJSON;
      try {
        msgJSON = JSON.parse(message);
      } catch (err) {
        logger.error('invalid message', message, err);
        return;
      }
      clientData.topic = msgJSON.topic;
      const topicMsgs = allMessages[msgJSON.topic] || [];
      let startIndex = topicMsgs.length - msgJSON.count;
      if (startIndex < 0) startIndex = 0;
      const messages = topicMsgs.slice(startIndex);
      // the 'full' flag is true, indicating the messages are full latest messages for client side,
      // client side should clear the existing messages if any for the topic
      if (clientData.authorized) {
        sendData(ws, { full: true, topic: msgJSON.topic, messages });
      }
    });

    // terminate web socket
    const terminateWS = () => {
      if (clientData.terminated) {
        return;
      }
      clientData.terminated = true;

      for (let i = 0; i < allWS.length; i += 1) {
        if (id === allWS[i].id) {
          // remove the current client data
          allWS.splice(i, 1);
          break;
        }
      }
      ws.close();
    };

    // close event handler
    ws.on('close', () => {
      logger.debug('web socket closed');
      terminateWS();
    });

    // error event handler
    ws.on('error', (err) => {
      logger.error('there is error for the web socket', err);
      terminateWS();
    });
  });

  wss.on('error', (err) => {
    logger.error('there is error for the web socket server', err);
  });
};

/**
 * Send message to all applicable web socket clients. The message will be cached to be retrieved by clients.
 */
const sendMessage = (topic, message) => {
  // cache message
  if (!allMessages[topic]) allMessages[topic] = [];
  allMessages[topic].push(message);
  if (allMessages[topic].length > maxMsgCount) allMessages[topic].shift();

  // send message to clients
  _.each(allWS, (clientData) => {
    if (topic === clientData.topic && clientData.authorized) {
      // the 'full' flag is false, indicating the message is to be added to client side
      sendData(clientData.ws, { full: false, topic, messages: [message] });
    }
  });
};

module.exports = {
  setup,
  sendMessage,
};
