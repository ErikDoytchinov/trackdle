const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const multiplayerController = require('../controllers/multiplayerController');

// Create a new lobby
router.post('/lobby', protect, multiplayerController.createLobby);

// Get specific lobby
router.get('/lobby/:lobbyId', protect, multiplayerController.getLobby);

module.exports = router;
