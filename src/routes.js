'use strict';

module.exports = {
  '/topics': {
    get: {
      controller: 'DataStreamController',
      method: 'getAllTopics',
    },
  },
  '/message-to-kafka': {
    post: {
      controller: 'DataStreamController',
      method: 'sendMessageToKafka',
    },
  },
};
