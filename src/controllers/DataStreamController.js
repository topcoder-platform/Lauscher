/**
 * Contains endpoints related to data stream.
 */
'use strict';

const DataStreamService = require('../services/DataStreamService');

/**
 * Get all topics.
 * @param req the request
 * @param res the response
 */
function* getAllTopics(req, res) {
  res.json(yield DataStreamService.getAllTopics());
}

/**
 * Send message to kafka.
 * @param req the request
 * @param res the response
 */
function* sendMessageToKafka(req, res) {
  yield DataStreamService.sendMessageToKafka(req.body);
  res.end();
}

// Exports
module.exports = {
  getAllTopics,
  sendMessageToKafka,
};
