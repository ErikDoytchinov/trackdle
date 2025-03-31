const express = require('express');
const router = express.Router();

const playlistRoutes = require('./playlist');
const guessRoutes = require('./guess');
const sessionRoutes = require('./session');

router.use('/playlist', playlistRoutes);
router.use('/guess', guessRoutes);
router.use('/session', sessionRoutes);

module.exports = router;