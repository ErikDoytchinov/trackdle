const express = require('express');
const router = express.Router();

const playlistRoutes = require('./playlist');
const guessRoutes = require('./guess');
// In the future add: const authRoutes = require('./auth');

router.use('/playlist', playlistRoutes);
router.use('/guess', guessRoutes);
// router.use('/auth', authRoutes);

module.exports = router;