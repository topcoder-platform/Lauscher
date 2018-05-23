/**
 * The configuration file.
 */
module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  PORT: process.env.PORT || 4000,
  // see https://www.npmjs.com/package/no-kafka for available options
  KAFKA_OPTIONS: {
    connectionString: process.env.KAFKA_URL || 'localhost:9092',
    ssl: {
      cert: process.env.KAFKA_CLIENT_CERT,
      key: process.env.KAFKA_CLIENT_CERT_KEY,
    },
  },
  // max message count to cache per topic
  MAX_MESSAGE_COUNT: process.env.MAX_MESSAGE_COUNT || 10000,
};
