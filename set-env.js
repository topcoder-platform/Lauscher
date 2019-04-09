const { writeFile } = require('fs');

const targetPath = './ui/src/config/config.js';

const envConfigFile = `
const config = {
  API_URL: '${process.env.API_URL || 'http://localhost:3000'}/api/v1',
  WS_URL: '${process.env.WS_URL || 'ws://localhost:3000'}',
  DEFAULT_MESSAGE_COUNT: ${process.env.DEFAULT_MESSAGE_COUNT} || 20,
  TC_AUTH_URL: '${process.env.TC_AUTH_URL || 'https://accounts.topcoder-dev.com'}',
  ACCOUNTS_APP_CONNECTOR: '${process.env.ACCOUNTS_APP_CONNECTOR || 'https://accounts.topcoder-dev.com/connector.html'}',
  APP_URL: '${process.env.APP_URL || 'http://localhost:3000'}',
  ROLES: ['Administrator', 'Copilot']
};

export default config;

`;

writeFile(targetPath, envConfigFile, (err) => {
  if (err) {
    console.log('Error during environment variable generation');
    console.error(err);
  } else {
    console.log('Environment file generated successfully');
  }
});
