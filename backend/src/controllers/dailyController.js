let logger = require('../config/logger');
const DailySong = require('../models/dailySongModel');
const User = require('../models/userModel');

const getDailyStatus = async (req, res) => {
  try {
    const now = new Date();
    const currentDailyId = now.toISOString().split('T')[0];

    let available = false;
    if (req.user) {
      if (req.user.canPlayDaily) {
        available = true;
      }
    }

    const nextMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );

    const diffMs = nextMidnight - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    res.json({
      available,
      next_available_at: nextMidnight.toISOString(),
      current_daily: {
        id: currentDailyId,
      },
      time_remaining: {
        hours,
        minutes,
        seconds,
      },
    });
  } catch (err) {
    logger.error(`Error getting daily status: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getDailyStatus };
