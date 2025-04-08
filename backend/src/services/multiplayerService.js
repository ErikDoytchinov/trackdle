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
    throw new Error('Lobby not found');
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

  if (!lobby) throw new Error('Lobby not found');
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
// const togglePlayerReady = async (lobbyId, userId) => {
//   // Log the received lobbyId for debugging
//   logger.info(
//     `Toggle ready called with lobbyId: ${lobbyId} (type: ${typeof lobbyId})`
//   );

//   if (!lobbyId) {
//     throw new Error('Invalid lobby ID: ID is empty or undefined');
//   }

//   // Handle different types of IDs
//   let query = {};

//   // If it's already an ObjectId or a valid ObjectId string
//   if (mongoose.Types.ObjectId.isValid(lobbyId)) {
//     const objectId =
//       typeof lobbyId === 'string' ? mongoose.Types.ObjectId(lobbyId) : lobbyId;

//     query = { _id: objectId };
//     logger.info(`Searching by ObjectId: ${objectId}`);
//   }
//   // If it's a string but not a valid ObjectId, try as lobbyCode
//   else if (typeof lobbyId === 'string') {
//     query = {
//       $or: [{ lobbyCode: lobbyId.toUpperCase() }, { lobbyCode: lobbyId }],
//     };
//     logger.info(`Searching by lobbyCode: ${lobbyId}`);
//   }
//   // If it's an object with _id property (from frontend)
//   else if (typeof lobbyId === 'object' && lobbyId._id) {
//     const idValue = lobbyId._id.toString ? lobbyId._id.toString() : lobbyId._id;
//     if (mongoose.Types.ObjectId.isValid(idValue)) {
//       query = { _id: mongoose.Types.ObjectId(idValue) };
//       logger.info(`Searching by extracted ObjectId: ${idValue}`);
//     } else {
//       throw new Error(`Invalid lobby ID format: ${JSON.stringify(lobbyId)}`);
//     }
//   } else {
//     throw new Error(`Unsupported lobby ID format: ${JSON.stringify(lobbyId)}`);
//   }

//   // Add more detailed logging
//   logger.info(`Query for finding lobby: ${JSON.stringify(query)}`);

//   const lobby = await MultiplayerLobby.findOne(query);

//   if (!lobby) {
//     logger.error(`No lobby found with query: ${JSON.stringify(query)}`);
//     throw new Error('Lobby not found');
//   }

//   logger.info(`Found lobby: ${lobby._id}`);

//   const playerIndex = lobby.players.findIndex(
//     (p) => p.userId.toString() === userId.toString()
//   );

//   if (playerIndex === -1) {
//     throw new Error('Player not in lobby');
//   }

//   lobby.players[playerIndex].ready = !lobby.players[playerIndex].ready;
//   await lobby.save();

//   logger.info(
//     `User ${userId} toggled ready status to ${lobby.players[playerIndex].ready} in lobby ${lobby._id}`
//   );
//   return lobby;
// };

/**
 * Leave a lobby
 */
const leaveLobby = async (lobbyId, userId) => {
  const lobby = await MultiplayerLobby.findById(lobbyId);
  if (!lobby) {
    throw new Error('Lobby not found');
  }

  lobby.players = lobby.players.filter(
    (p) => p.userId.toString() !== userId.toString()
  );

  if (lobby.ownerId.toString() === userId.toString()) {
    if (lobby.players.length > 0) {
      lobby.ownerId = lobby.players[0].userId;
    } else {
      await MultiplayerLobby.findByIdAndDelete(lobbyId);
      logger.info(`Lobby ${lobbyId} deleted as all players left`);
      return null;
    }
  }

  await lobby.save();
  logger.info(`User ${userId} left lobby ${lobbyId}`);
  return lobby;
};

/**
 * Handle player disconnect
 */
const handlePlayerDisconnect = async (userId) => {
  const lobbies = await MultiplayerLobby.find({
    'players.userId': userId,
  });

  for (const lobby of lobbies) {
    await leaveLobby(lobby._id, userId);
  }
};

module.exports = {
  createLobby,
  getLobby,
  joinLobby,
  leaveLobby,
  handlePlayerDisconnect,
};
