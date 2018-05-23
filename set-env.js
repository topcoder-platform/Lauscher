const { writeFile } = require('fs');

const targetPath = './ui/src/config/config.js';

const envConfigFile = `
const config = {
  API_URL: '${process.env.API_URL || 'http://localhost:4000'}/api/v1',
  WS_URL: '${process.env.WS_URL || 'ws://localhost:4000'}',
  DEFAULT_MESSAGE_COUNT: ${process.env.DEFAULT_MESSAGE_COUNT || 20}
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
