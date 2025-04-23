const User = require('../models/userModel');

/**
 * GET /daily/status
 * Returns the status of the daily challenge.
 * If the user is authenticated, it returns whether they can play the daily challenge.
 * It also returns the seconds remaining until the next daily challenge is available.
 */
const getDailyStatus = async (req, res) => {
  try {
    const now = new Date();
    let available = false;
    if (req.user && req.user.canPlayDaily) {
      available = true;
    }

    const nextMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const seconds_until_next = Math.max(
      0,
      Math.floor((nextMidnight - now) / 1000)
    );

    res.json({
      available,
      seconds_until_next,
    });
  } catch (err) {
    logger.error(`Error getting daily status: ${err.message}`);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * GET /stats
 * Returns the user's game statistics.
 * If the user is not authenticated, it returns a 401 status.
 * If the user is authenticated, it returns their game statistics.
 */
const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      gamesPlayed: user.gamesPlayed,
      correctGuesses: user.correctGuesses,
      averageAttempts: user.averageAttempts,
      totalPlaytime: user.totalPlaytime,
      winRate: user.winRate,
    });
  } catch (err) {
    res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};

module.exports = {
  getDailyStatus,
  getStats,
};
