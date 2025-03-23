require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const logger = require('./config/logger');

const allowedOrigins = [
  'https://trackdle.doytchinov.eu',
  'https://www.trackdle.doytchinov.eu',
  'http://localhost:5173',
];

function createApp() {
  const app = express();

  app.use(morgan('combined'));

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '5mb' }));

  app.use((req, res, next) => {
    logger.info(`Incoming request: ${req.method} ${req.url}`);
    next();
  });

  app.use('/', routes);

  return app;
}

module.exports = createApp;
