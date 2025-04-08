const multiplayerService = require('../services/multiplayerService');
const logger = require('../config/logger');

/**
 * POST /multiplayer/lobby
 * Creates a new multiplayer lobby
 */
const createLobby = async (req, res) => {
  try {
    const { maxPlayers, songCount, maxAttempts } = req.body;
    const settings = {
      maxPlayers: maxPlayers || 4,
      songCount: songCount || 5,
      maxAttempts: maxAttempts || 5,
    };

    const lobby = await multiplayerService.createLobby(req.user._id, settings);

    res.status(201).json({
      success: true,
      lobbyId: lobby._id,
      lobbyCode: lobby._id.toString().slice(-6).toUpperCase(), // Short code for easy sharing
      ownerId: lobby.ownerId,
      players: lobby.players,
      maxPlayers: lobby.maxPlayers,
      gameSettings: lobby.gameSettings,
    });
  } catch (err) {
    logger.error(`Error creating lobby: ${err.message}`);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /multiplayer/lobby/:lobbyId
 * Get specific lobby details
 */
const getLobby = async (req, res) => {
  try {
    const lobby = await multiplayerService.getLobby(req.params.lobbyId);

    const formattedPlayers = lobby.players.map((player) => ({
      id: player.userId,
      email: player.email,
      ready: player.ready,
      score: player.score,
      isOwner: lobby.ownerId.toString() === player.userId.toString(),
    }));

    res.json({
      success: true,
      lobby: {
        id: lobby._id,
        lobbyCode: lobby._id.toString().slice(-6).toUpperCase(),
        status: lobby.status,
        players: formattedPlayers,
        maxPlayers: lobby.maxPlayers,
        ownerId: lobby.ownerId,
        gameSettings: lobby.gameSettings,
        activeGameId: lobby.activeGameId,
      },
    });
  } catch (err) {
    logger.error(`Error getting lobby: ${err.message}`);
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  createLobby,
  getLobby,
};
