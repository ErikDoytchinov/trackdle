const User = require('../models/userModel');

exports.getStats = async (req, res) => {
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
    res.status(500).json({ message: err.message });
  }
};
