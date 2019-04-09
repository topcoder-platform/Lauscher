/**
 * The application entry point
 */
'use strict';

require('./bootstrap');
const path = require('path');
const config = require('config');
const express = require('express');
const _ = require('lodash');
const cors = require('cors');
const bodyParser = require('body-parser');
const helper = require('./common/helper');
const logger = require('./common/logger');
const errors = require('./common/errors');
const dataStreamWS = require('./dataStreamWS');
const http = require('http');
const authenticator = require('tc-core-library-js').middleware.jwtAuthenticator;

const app = express();
app.set('port', config.PORT);

// static content
app.use(express.static(path.join(__dirname, '../ui/build')));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const apiRouter = express.Router();

// load all routes
_.each(require('./routes'), (verbs, url) => {
  _.each(verbs, (def, verb) => {
    const actions = [];
    const method = require('./controllers/' + def.controller)[def.method];
    if (!method) {
      throw new Error(def.method + ' is undefined');
    }
    actions.push((req, res, next) => {
      req.signature = `${def.controller}#${def.method}`;
      next();
    });

    // TC authentication and authorization
    actions.push((req, res, next) => {
      authenticator(_.pick(config, ['AUTH_SECRET', 'VALID_ISSUERS']))(req, res, next);
    });
    actions.push((req, res, next) => {
      if (!req.authUser) {
        return next(new errors.UnauthorizedError('Action is not allowed for anonymous'));
      }
      if (!helper.isAuthorized(req.authUser)) {
        return next(new errors.ForbiddenError('You are not allowed to perform this action!'));
      }
      return next();
    });

    actions.push(method);
    apiRouter[verb](url, helper.autoWrapExpress(actions));
  });
});

app.use('/api/v1', apiRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'route not found' });
});

app.use((err, req, res, next) => { // eslint-disable-line
  logger.logFullError(err, req.signature);
  let status = err.httpStatus || 500;
  if (err.isJoi) {
    status = 400;
  }
  res.status(status);
  if (err.isJoi) {
    res.json({
      error: 'Validation failed',
      details: err.details,
    });
  } else {
    res.json({
      error: err.message,
    });
  }
});

if (!module.parent) {
  const server = http.createServer(app);
  dataStreamWS.setup(server);
  server.listen(app.get('port'));
  logger.info(`Express server listening on port ${app.get('port')}`);
} else {
  module.exports = app;
}
