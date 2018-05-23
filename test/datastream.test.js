/**
 * The test cases for the REST API.
 */
'use strict';

const expect = require('chai').expect;
let request = require('supertest');
const app = require('../src/app');

request = request(app);

describe('Topcoder Data Stream REST API Tests', () => {
  it('get all topics', (done) => {
    request.get('/api/v1/topics')
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        expect(res.body.length > 0).to.equal(true);
        // ensures the topics are sorted properly
        for (let i = 0; i + 1 < res.body.length; i += 1) {
          expect(res.body[i] < res.body[i + 1]).to.equal(true);
        }
        return done();
      });
  });

  it('send message to Kafka', (done) => {
    request.post('/api/v1/message-to-kafka')
      .send({ topic: 'challenge.notification.create', message: 'some message' })
      .expect(200, done);
  });

  it('send message to Kafka - missing topic', (done) => {
    request.post('/api/v1/message-to-kafka')
      .send({ message: 'some message' })
      .expect(400, done);
  });

  it('send message to Kafka - invalid message', (done) => {
    request.post('/api/v1/message-to-kafka')
      .send({ topic: 'challenge.notification.create', message: 123 })
      .expect(400, done);
  });
});
