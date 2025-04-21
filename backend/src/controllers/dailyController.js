let logger = require('../config/logger');

/**
 * GET /daily/status
 * Returns the status of the daily challenge.
 * If the user is authenticated, it returns whether they can play the daily challenge.
 * It also returns the time remaining until the next daily challenge is available.
 */
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
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

module.exports = { getDailyStatus };
