/**
 * Service for TC data stream.
 */

'use strict';

const _ = require('lodash');
const config = require('config');
const Joi = require('joi');
const logger = require('../common/logger');
const Kafka = require('no-kafka');
const dataStreamWS = require('../dataStreamWS');

// key is topic, value is consumer for the topic
const consumers = {};

/**
 * Get all topics. It will initialize consumer to consume topics if the topics was not consumed yet.
 * @returns {Array} all topics
 */
function* getAllTopics() {
  const consumer = new Kafka.SimpleConsumer(config.KAFKA_OPTIONS);
  yield consumer.init();

  // data handler
  const dataHandler = (messageSet, topic, partition) => Promise.each(messageSet, (m) => {
    const message = m.message.value.toString('utf8');
    logger.info(`Handle Kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${
      m.offset}; Message: ${message}.`);
    dataStreamWS.sendMessage(topic, message);
    consumer.commitOffset({ topic, partition, offset: m.offset });
  });

  const topics = [];
  _.each(_.keys(consumer.client.topicMetadata), (tp) => {
    // ignore Kafka system topics
    if (!tp.startsWith('__')) {
      topics.push(tp);
      // if the topic was not handled yet, then let the consumer handle the topic
      if (!consumers[tp]) {
        consumer.subscribe(tp, { time: Kafka.LATEST_OFFSET }, dataHandler);
        consumers[tp] = consumer;
      }
    }
  });
  return topics;
}

/**
 * Send message to Kafka.
 * @param {Object} data the request data
 */
function* sendMessageToKafka(data) {
  const producer = new Kafka.Producer(config.KAFKA_OPTIONS);
  yield producer.init();
  producer.send({
    topic: data.topic,
    message: {
      value: data.message,
    },
  });
}

sendMessageToKafka.schema = {
  data: Joi.object().keys({
    topic: Joi.string().required(),
    message: Joi.string().required(),
  }).required(),
};

// Exports
module.exports = {
  getAllTopics,
  sendMessageToKafka,
};
