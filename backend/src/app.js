require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const logger = require('./config/logger');
const mongoose = require('mongoose');
const cron = require('node-cron');
const User = require('./models/userModel');
const generateDailySong = require('./scheduler/dailySongScheduler');

const allowedOrigins = [
  'https://trackdle.doytchinov.eu',
  'https://www.trackdle.doytchinov.eu',
  'http://localhost:5173',
];

function createApp() {
  const app = express();

  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );

  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '5mb' }));

  // schedule a job to run every day at midnight (server time or adjust for UTC)
  cron.schedule(
    '0 0 * * *',
    async () => {
      await User.updateMany({}, { canPlayDaily: true });
      logger.info('Daily play flag reset for all users.');
      generateDailySong();
      logger.info('Daily song generated.');
    },
    {
      timezone: 'UTC',
    }
  );

  const mongoURI =
    process.env.MONGO_URI || 'mongodb://localhost:27017/trackdle';

  mongoose
    .connect(mongoURI)
    .then(() => logger.info('MongoDB connected'))
    .catch((err) => logger.error('MongoDB connection error:', err));

  app.use('/', routes);

  return app;
}

module.exports = createApp;
