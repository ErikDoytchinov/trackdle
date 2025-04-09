const logger = require('../config/logger');
const User = require('../models/userModel');
const MultiplayerLobby = require('../models/multiplayerLobbyModel');

/**
 * Create a new multiplayer lobby
 */
const createLobby = async (userId, settings = {}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const lobby = new MultiplayerLobby({
    ownerId: userId,
    players: [
      {
        userId: userId,
        email: user.email,
        ready: false,
        score: 0,
      },
    ],
    status: 'waiting',
    maxPlayers: settings.maxPlayers || 4,
    gameSettings: {
      songCount: settings.songCount || 5,
      maxAttempts: settings.maxAttempts || 5,
    },
  });

  await lobby.save();
  logger.info(`Created multiplayer lobby: ${lobby._id} by user: ${userId}`);
  return lobby;
};

/**
 * Get a lobby by ID
 */
const getLobby = async (lobbyId) => {
  const lobby = await MultiplayerLobby.findById(lobbyId);
  if (!lobby) {
    throw new Error('Lobby not found when trying to get it');
  }
  return lobby;
};

/**
 * Join a lobby
 */
const joinLobby = async (lobbyId, userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const lobby = await MultiplayerLobby.findOne({
    $or: [{ _id: lobbyId }, { lobbyCode: lobbyId }],
  });

  if (!lobby) throw new Error('Lobby not found when trying to join it');
  if (lobby.status !== 'waiting')
    throw new Error('Lobby is not accepting players');
  if (lobby.players.length >= lobby.maxPlayers)
    throw new Error('Lobby is full');

  const existingPlayer = lobby.players.find(
    (p) => p.userId.toString() === userId.toString()
  );
  if (!existingPlayer) {
    lobby.players.push({
      userId: userId,
      email: user.email,
      ready: false,
      score: 0,
    });
    await lobby.save();
  }

  return lobby;
};

/**
 * Toggle player ready status
 */
const togglePlayerReady = async (lobbyId, userId) => {
  const lobby = await MultiplayerLobby.findById(lobbyId);
  if (!lobby) throw new Error('Lobby not found when trying to toggle ready');

  const playerIndex = lobby.players.findIndex(
    (p) => p.userId.toString() === userId.toString()
  );
  if (playerIndex === -1) throw new Error('Player not found in lobby');

  lobby.players[playerIndex].ready = !lobby.players[playerIndex].ready;
  await lobby.save();

  return lobby;
};

/**
 * Leave a lobby
 */
const leaveLobby = async (lobbyId, userId) => {
  try {
    const lobby = await MultiplayerLobby.findById(lobbyId);
    if (!lobby) {
      logger.info(
        `Lobby ${lobbyId} not found when user ${userId} tried to leave - it may have been deleted already`
      );
      return null;
    }

    // Check if player is already removed
    const playerExists = lobby.players.some(
      (p) => p.userId.toString() === userId.toString()
    );
    if (!playerExists) {
      logger.info(`User ${userId} already removed from lobby ${lobbyId}`);
      return lobby;
    }

    lobby.players = lobby.players.filter(
      (p) => p.userId.toString() !== userId.toString()
    );

    if (lobby.ownerId.toString() === userId.toString()) {
      if (lobby.players.length > 0) {
        lobby.ownerId = lobby.players[0].userId;
        logger.info(
          `Ownership of lobby ${lobbyId} transferred to ${lobby.ownerId}`
        );
      } else {
        await MultiplayerLobby.findByIdAndDelete(lobbyId);
        logger.info(`Lobby ${lobbyId} deleted as all players left`);
        return null;
      }
    }

    await lobby.save();
    logger.info(`User ${userId} left lobby ${lobbyId}`);
    return lobby;
  } catch (err) {
    logger.error(`Error in leaveLobby: ${err.message}`);
    // Return null instead of throwing to prevent cascading errors
    return null;
  }
};

/**
 * Handle player disconnect
 */
const handlePlayerDisconnect = async (userId) => {
  try {
    const lobbies = await MultiplayerLobby.find({
      'players.userId': userId,
    });

    logger.info(
      `Found ${lobbies.length} lobbies with user ${userId} during disconnect`
    );

    for (const lobby of lobbies) {
      await leaveLobby(lobby._id, userId);
    }
  } catch (err) {
    logger.error(`Error in handlePlayerDisconnect: ${err.message}`);
    // Don't throw - we want disconnect handling to be resilient
  }
};

module.exports = {
  createLobby,
  getLobby,
  joinLobby,
  togglePlayerReady,
  leaveLobby,
  handlePlayerDisconnect,
};
