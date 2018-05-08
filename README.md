# Topcoder Data Stream User Interface


## Dependencies
- nodejs https://nodejs.org/en/ (v8+)


## Configuration
Configuration for the notification server is at `config/default.js`.
The following parameters can be set in config files or in env variables:
- LOG_LEVEL: the log level
- PORT: the server port
- KAFKA_OPTIONS: Kafka consumer options, see https://www.npmjs.com/package/no-kafka for available options

For the Kafka connection options:
- connectionString is comma delimited list of initial brokers list
- secure connection may be achieved via ssl field, see https://www.npmjs.com/package/no-kafka#ssl for details


## Local Kafka setup

- `http://kafka.apache.org/quickstart` contains details to setup and manage Kafka server,
  below provides details to setup Kafka server in Mac, Windows will use bat commands in bin/windows instead
- download kafka at `https://www.apache.org/dyn/closer.cgi?path=/kafka/1.1.0/kafka_2.11-1.1.0.tgz`
- extract out the doanlowded tgz file
- go to extracted directory kafka_2.11-0.11.0.1
- start ZooKeeper server:
  `bin/zookeeper-server-start.sh config/zookeeper.properties`
- use another terminal, go to same directory, start the Kafka server:
  `bin/kafka-server-start.sh config/server.properties`
- note that the zookeeper server is at localhost:2181, and Kafka server is at localhost:9092
- use another terminal, go to same directory, create a topic:
  `bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic challenge.notification.create`
- verify that the topic is created:
  `bin/kafka-topics.sh --list --zookeeper localhost:2181`,
  it should list out the created topics
- run the producer and then type a few messages into the console to send to the server:
  `bin/kafka-console-producer.sh --broker-list localhost:9092 --topic challenge.notification.create`
  in the console, write some messages, one per line:
  `{ "topic": "challenge.notification.create", "originator": "ap-challenge-api", "mime-type": "application/json", "payload": { "challenge": { "id": 123 } }, "timestamp": "2018-4-30 1:2:3" }`
  `{ "topic": "challenge.notification.create", "originator": "ap-challenge-api", "mime-type": "application/json", "payload": { "challenge": { "id": 456 } }, "timestamp": "2018-4-30 1:2:4" }`
  we can keep this producer so that we may send more messages later for verification
- use another terminal, go to same directory, start a consumer to view the messages:
  `bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic challenge.notification.create --from-beginning`


## Front end UI setup

- the front end UI's build folder content are exposed as public content by the app, so you may directly access it
  via http://localhost:4000
- or if you want to use it for development, then you may go to ui folder:
  run `npm install`, `npm start`, then access `http://localhost:3000`
- note that if the front end UI's config is changed, it must be re-built using `npm run build` in the ui folder


## Local deployment
- setup Kafka as above
- install dependencies `npm i`
- run code lint check `npm run lint`
- run test `npm run test`
- start app `npm start`, the app is running at `http://localhost:4000`


## Heroku Deployment
- git init
- git add .
- git commit -m message
- heroku create
- heroku config:set KAFKA_CONSUMER_URL=some-public-kafka-url
- heroku config:set KAFKA_PRODUCER_URL=some-public-kafka-url
- git push heroku master



## Verification

- setup stuff following above deployment
- in the UI, select a topic to view topic data stream
- use the kafka-console-producer to generate some messages as above,
  then watch the UI, it should got some messages
- filter the messages and see results
- use the UI to post message to Kafka, see above for example message, the data stream table should also show the posted message
- you may also use the above kafka-console-consumer to view the Kafka messages

