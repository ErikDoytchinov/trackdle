const express = require('express');
const router = express.Router();
const multiplayerController = require('../controllers/multiplayerController');
const { protect } = require('../middleware/authMiddleware');

// Create a new lobby
router.post('/lobby', protect, multiplayerController.createLobby);

// Get specific lobby
router.get('/lobby/:lobbyId', protect, multiplayerController.getLobby);

module.exports = router;
