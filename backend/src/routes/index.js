const express = require('express');
const router = express.Router();

const sessionRoutes = require('./session');
const userRoutes = require('./user');
const authRoutes = require('./auth');

router.use('/session', sessionRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);

module.exports = router;