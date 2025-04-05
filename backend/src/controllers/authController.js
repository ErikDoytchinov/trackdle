const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const generateToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const user = await User.create({ email, password });
    const token = generateToken(user);
    res.json({
      token,
      user: {
        email: user.email,
        gamesPlayed: user.gamesPlayed,
        correctGuesses: user.correctGuesses,
        averageAttempts: user.averageAttempts,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(user);
    res.json({
      token,
      user: {
        email: user.email,
        gamesPlayed: user.gamesPlayed,
        correctGuesses: user.correctGuesses,
        averageAttempts: user.averageAttempts,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      user: {
        email: user.email,
        gamesPlayed: user.gamesPlayed,
        correctGuesses: user.correctGuesses,
        averageAttempts: user.averageAttempts,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
