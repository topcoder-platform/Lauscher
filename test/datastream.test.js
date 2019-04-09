/**
 * The test cases for the REST API.
 */
'use strict';

// During the test the NODE_ENV env variable is set to test
process.env.NODE_ENV = 'test';

const config = require('config');
const expect = require('chai').expect;
let request = require('supertest');
const app = require('../src/app');

request = request(app);

describe('Topcoder Data Stream REST API Tests', () => {
  it('get all topics by admin', (done) => {
    request.get('/api/v1/topics')
      .set('Authorization', `Bearer ${config.ADMIN_TOKEN}`)
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

  it('get all topics by copilot', (done) => {
    request.get('/api/v1/topics')
      .set('Authorization', `Bearer ${config.COPILOT_TOKEN}`)
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

  it('get all topics by normal user', (done) => {
    request.get('/api/v1/topics')
      .set('Authorization', `Bearer ${config.USER_TOKEN}`)
      .expect(403, done);
  });

  it('get all topics with invalid token', (done) => {
    request.get('/api/v1/topics')
      .set('Authorization', 'Bearer invalid')
      .expect(403, done);
  });

  it('get all topics without token', (done) => {
    request.get('/api/v1/topics')
      .set('Authorization', 'Bearer invalid')
      .expect(403, done);
  });

  it('send message to Kafka by admin', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.ADMIN_TOKEN}`)
      .send({ topic: 'challenge.notification.create', message: 'some message' })
      .expect(200, done);
  });

  it('send message to Kafka by copilot', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.COPILOT_TOKEN}`)
      .send({ topic: 'challenge.notification.create', message: 'some message' })
      .expect(200, done);
  });

  it('send message to Kafka by normal user', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.USER_TOKEN}`)
      .send({ topic: 'challenge.notification.create', message: 'some message' })
      .expect(403, done);
  });

  it('send message to Kafka with invalid token', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', 'Bearer invalid')
      .send({ topic: 'challenge.notification.create', message: 'some message' })
      .expect(403, done);
  });

  it('send message to Kafka without token', (done) => {
    request.post('/api/v1/message-to-kafka')
      .send({ topic: 'challenge.notification.create', message: 'some message' })
      .expect(403, done);
  });

  it('send message to Kafka - missing topic', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.ADMIN_TOKEN}`)
      .send({ message: 'some message' })
      .expect(400, done);
  });

  it('send message to Kafka - invalid topic', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.ADMIN_TOKEN}`)
      .send({ topic: { invalid: true }, message: 'some message' })
      .expect(400, done);
  });

  it('send message to Kafka - invalid message', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.COPILOT_TOKEN}`)
      .send({ topic: 'challenge.notification.create', message: 123 })
      .expect(400, done);
  });

  it('send message to Kafka - empty message', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.COPILOT_TOKEN}`)
      .send({ topic: 'challenge.notification.create', message: '' })
      .expect(400, done);
  });

  it('send message to Kafka - missing message', (done) => {
    request.post('/api/v1/message-to-kafka')
      .set('Authorization', `Bearer ${config.COPILOT_TOKEN}`)
      .send({ topic: 'challenge.notification.create' })
      .expect(400, done);
  });
});
