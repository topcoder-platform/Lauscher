import superagent from 'superagent';
import config from '../config/config';

const API = {

  // get all Kafka topics
  getAllTopics: (token, cb) => {
    superagent.get(`${config.API_URL}/topics`).set('Authorization', 'Bearer ' + token).end((err, res) => {
      if (err) {
        cb(`Failed to get topics. ${err}`);
      } else {
        cb(null, res.body);
      }
    });
  },

  // send message to Kafka topic
  sendMessageToKafka: (token, topic, message, cb) => {
    superagent.post(`${config.API_URL}/message-to-kafka`)
      .set('Authorization', 'Bearer ' + token).send({ topic, message }).end((err) => {
        if (err) {
          cb(`Failed to send message. ${err}`);
        } else {
          cb();
        }
      });
  },

};

export default API;
