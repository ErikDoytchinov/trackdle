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
const moment = require('moment');
const expressRateLimit = require('express-rate-limit');

const allowedOrigins = [
  'https://trackdle.doytchinov.eu',
  'https://www.trackdle.doytchinov.eu',
  'http://localhost:5173',
];

async function ensureDailySongExists() {
  const DailySong = require('./models/dailySongModel');
  const today = moment().utc().format('YYYY-MM-DD');
  const existing = await DailySong.findOne({ date: today });
  if (!existing) {
    logger.info(`No daily song found for ${today}, generating one now...`);
    await generateDailySong();
  } else {
    logger.info(`Daily song for ${today} already exists.`);
  }
}

function createApp() {
  const app = express();

  const limiter = expressRateLimit({
    windowMs: 5 * 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests, please try again later.',
    },
  });
  app.use(limiter);

  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      skip: (req) => req.method === 'OPTIONS',
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

  // Schedule jobs to run at midnight and noon UTC every day
  cron.schedule(
    '0 0,12 * * *',
    async () => {
      // At midnight, reset the daily flag for all users
      if (new Date().getUTCHours() === 0) {
        await User.updateMany({}, { canPlayDaily: true });
        logger.info('Daily play flag reset for all users.');
      }

      // Both at midnight and noon, ensure daily song exists
      await ensureDailySongExists();
    },
    {
      timezone: 'UTC',
    }
  );

  const mongoURI =
    process.env.MONGO_URI || 'mongodb://localhost:27017/trackdle';

  mongoose
    .connect(mongoURI)
    .then(async () => {
      logger.info('MongoDB connected');

      // check for today's daily song on server startup
      try {
        await ensureDailySongExists();
      } catch (err) {
        logger.error(
          `Error ensuring daily song exists on startup: ${err.message}`
        );
      }
    })
    .catch((err) => logger.error('MongoDB connection error:', err));

  app.use('/', routes);

  return app;
}

module.exports = createApp;
