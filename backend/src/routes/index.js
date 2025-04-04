const express = require('express');
const router = express.Router();

const sessionRoutes = require('./session');
const userRoutes = require('./user');
const authRoutes = require('./auth');
const dailyRoutes = require('./daily');

router.use('/session', sessionRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/daily', dailyRoutes);
router.use('/', (_req, res) => {
  res.json({ message: 'Ping Pong' });
});

module.exports = router;
