const express = require('express');
const router = express.Router();
const { getPlaylist, getTargetTrack } = require('../controllers/playlistController.js');

router.get('/', getPlaylist);
router.post('/target', getTargetTrack);

module.exports = router;
