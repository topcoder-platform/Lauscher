import superagent from 'superagent';
import config from '../config/config';

const API = {

  // get all Kafka topics
  getAllTopics: (cb) => {
    superagent.get(`${config.API_URL}/topics`).end((err, res) => {
      if (err) {
        alert(`Failed to get topics. ${ err }`);
      } else {
        cb(res.body);
      }
    });
  },

  // send message to Kafka topic
  sendMessageToKafka: (topic, message, cb) => {
    superagent.post(`${config.API_URL}/message-to-kafka`).send({ topic, message }).end((err) => {
      if (err) {
        alert(`Failed to send message. ${ err }`);
      } else if (cb) {
        cb();
      }
    });
  },

};

export default API;
