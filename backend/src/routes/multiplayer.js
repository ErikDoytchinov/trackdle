const express = require('express');
const router = express.Router();
const multiplayerController = require('../controllers/multiplayerController');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /multiplayer/lobby
 * Creates a new multiplayer lobby
 */
router.post('/lobby', protect, multiplayerController.createLobby);

/**
 * GET /multiplayer/lobby/:lobbyId
 * Get specific lobby details
 */
router.get('/lobby/:lobbyId', protect, multiplayerController.getLobby);

/**
 * POST /multiplayer/game/:lobbyId
 * Start a multiplayer game session
 */
router.post('/game/:lobbyId', protect, multiplayerController.postGameSession);

/**
 * POST /multiplayer/game/:gameId/guess
 * Process a guess for the current song
 */
router.post('/game/:gameId/guess', protect, multiplayerController.postGuess);

/**
 * GET /multiplayer/game/:gameId/next
 * Get the next song for the player in the multiplayer game
 */
router.get('/game/:gameId/next', protect, multiplayerController.getNextSong);

module.exports = router;
