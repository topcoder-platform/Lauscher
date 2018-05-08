/**
 * Data stream web socket functionalities.
 */
'use strict';

const _ = require('lodash');
const logger = require('./common/logger');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const helper = require('./common/helper');

// all web socket client data
const allWS = [];

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
    };
    allWS.push(clientData);

    // got message from client
    ws.on('message', (message) => {
      logger.debug(`web socket message: ${message}`);
      if (message.startsWith('topic:') && message.length > 'topic:'.length) {
        clientData.topic = message.substring('topic:'.length);
      } else {
        logger.error(`invalid web socket message: ${message}`);
      }
    });

    // close event handler
    ws.on('close', () => {
      for (let i = 0; i < allWS.length; i += 1) {
        if (id === allWS[i].id) {
          // remove the current client data
          allWS.splice(i, 1);
          break;
        }
      }
      logger.debug('web socket closed');
    });
  });
};

/**
 * Send message to all applicable web socket clients.
 */
const sendMessage = (topic, message) => {
  _.each(allWS, (clientData) => {
    if (topic === clientData.topic) {
      try {
        clientData.ws.send(message);
      } catch (e) {
        logger.error(e);
      }
    }
  });
};

module.exports = {
  setup,
  sendMessage,
};
