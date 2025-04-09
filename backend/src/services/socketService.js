const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const MultiplayerLobby = require('../models/multiplayerLobbyModel');
const logger = require('../config/logger');
const multiplayerService = require('./multiplayerService');

let io;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://trackdle.doytchinov.eu',
      'https://www.trackdle.doytchinov.eu',
      'http://localhost:5173',
    ];

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          logger.warn(`Socket connection rejected from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      logger.warn('Socket connection attempt without token');
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        logger.warn(`Socket auth - user not found: ${decoded.id}`);
        return next(new Error('User not found'));
      }
      socket.user = user;
      next();
    } catch (err) {
      logger.error(`Socket auth error: ${err.message}`);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} - User: ${socket.user.email}`);

    socket.on('join-lobby', async (lobbyId, callback) => {
      try {
        for (const room of [...socket.rooms]) {
          if (room !== socket.id) {
            await socket.leave(room);
          }
        }

        const lobby = await multiplayerService.joinLobby(
          lobbyId,
          socket.user._id
        );
        await socket.join(lobbyId);

        io.to(lobbyId).emit('lobby-update', {
          players: lobby.players.map((p) => ({
            userId: p.userId,
            email: p.email,
            ready: p.ready,
            score: p.score,
          })),
          status: lobby.status,
          ownerId: lobby.ownerId,
          maxPlayers: lobby.maxPlayers,
          gameSettings: lobby.gameSettings,
        });

        callback(null, {
          success: true,
          lobbyId: lobby._id.toString(),
          lobbyCode: lobby.lobbyCode,
        });
      } catch (err) {
        logger.error(`Error joining lobby: ${err.message}`);
        callback({ success: false, message: err.message });
      }
    });

    socket.on('join-by-code', async (lobbyCode, callback) => {
      try {
        logger.info(`User ${socket.user.email} joining by code: ${lobbyCode}`);
        for (const room of [...socket.rooms]) {
          if (room !== socket.id) {
            logger.info(`User leaving room: ${room}`);
            await socket.leave(room);
          }
        }

        const allLobbies = await MultiplayerLobby.find({});
        const lobby = allLobbies.find(
          (l) =>
            l._id.toString().slice(-6).toUpperCase() === lobbyCode.toUpperCase()
        );

        if (!lobby) {
          logger.error(`Lobby not found for code: ${lobbyCode}`);
          throw new Error('Lobby not found');
        }

        const lobbyId = lobby._id.toString();
        logger.info(`Found lobby ${lobbyId} for code ${lobbyCode}`);

        const updatedLobby = await multiplayerService.joinLobby(
          lobby._id,
          socket.user._id
        );

        await socket.join(lobbyId);

        const roomMembers = await io.in(lobbyId).fetchSockets();
        logger.info(
          `Room ${lobbyId} has ${roomMembers.length} members after join`
        );

        logger.info(
          `Socket ${socket.id} rooms after join: ${[...socket.rooms].join(', ')}`
        );

        // Emit to all sockets in the room including the sender
        logger.info(`Broadcasting lobby-update to room ${lobbyId}`);
        io.to(lobbyId).emit('lobby-update', {
          players: updatedLobby.players.map((p) => ({
            userId: p.userId,
            email: p.email,
            ready: p.ready,
            score: p.score,
          })),
          status: updatedLobby.status,
          ownerId: updatedLobby.ownerId,
          maxPlayers: updatedLobby.maxPlayers,
          gameSettings: updatedLobby.gameSettings,
          lobbyCode: lobbyId.slice(-6).toUpperCase(),
        });

        callback(null, {
          success: true,
          lobbyId: lobbyId,
          lobbyCode: lobbyId.slice(-6).toUpperCase(),
        });
      } catch (err) {
        logger.error(`Error joining lobby by code: ${err.message}`);
        callback({ success: false, message: err.message });
      }
    });

    socket.on('leave-lobby', async (lobbyId) => {
      try {
        logger.info(`User ${socket.user.email} leaving lobby: ${lobbyId}`);
        const updatedLobby = await multiplayerService.leaveLobby(
          lobbyId,
          socket.user._id
        );
        await socket.leave(lobbyId);

        if (updatedLobby) {
          io.to(lobbyId).emit('lobby-update', {
            players: updatedLobby.players.map((p) => ({
              userId: p.userId,
              email: p.email,
              ready: p.ready,
              score: p.score,
            })),
            status: updatedLobby.status,
            ownerId: updatedLobby.ownerId,
          });
        }

        socket.emit('left-lobby', {
          message: 'Left lobby successfully',
        });
      } catch (err) {
        logger.error(`Error leaving lobby: ${err.message}`);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('toggle-ready', async (lobbyId) => {
      try {
        logger.info(
          `Toggle ready request for lobby: ${lobbyId} by user: ${socket.user.email}`
        );

        const objectId = new mongoose.Types.ObjectId(lobbyId);

        const lobby = await multiplayerService.togglePlayerReady(
          objectId,
          socket.user._id
        );

        // get the string representation for room targeting
        const lobbyIdString = lobbyId.toString ? lobbyId.toString() : lobbyId;
        logger.info(
          `Emitting lobby-update for toggle-ready to room ${lobbyIdString}`
        );

        // Log current room membership
        const roomMembers = await io.in(lobbyIdString).fetchSockets();
        logger.info(
          `Room ${lobbyIdString} has ${roomMembers.length} members before toggle-ready update`
        );

        io.to(lobbyIdString).emit('lobby-update', {
          players: lobby.players.map((p) => ({
            userId: p.userId,
            email: p.email,
            ready: p.ready,
            score: p.score,
          })),
          status: lobby.status,
          ownerId: lobby.ownerId,
          maxPlayers: lobby.maxPlayers,
          gameSettings: lobby.gameSettings,
          lobbyCode: lobbyIdString.slice(-6).toUpperCase(),
        });

        // if all players are ready, notify the owner
        const allReady = lobby.players.every((p) => p.ready);
        if (allReady) {
          logger.info(
            `All players ready in room ${lobbyIdString}, emitting event`
          );
          io.to(lobbyIdString).emit('all-players-ready');
        }
      } catch (err) {
        logger.error(`Error toggling ready: ${err.message}`);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('start-game', async (lobbyId) => {
      try {
        logger.info(
          `Start game request for lobby: ${lobbyId} by user: ${socket.user.email}`
        );
        const objectId = new mongoose.Types.ObjectId(lobbyId);

        const lobby = await multiplayerService.startGame(
          objectId,
          socket.user._id
        );

        // get the string representation for room targeting
        const lobbyIdString = lobbyId.toString ? lobbyId.toString() : lobbyId;
        logger.info(`Emitting game-started event to room ${lobbyIdString}`);

        io.to(lobbyIdString).emit('game-started', {
          tracks: lobby.tracks,
          gameSettings: lobby.gameSettings,
          ownerId: lobby.ownerId,
          maxPlayers: lobby.maxPlayers,
          gameStartedAt: Date.now(),
        });
      } catch (err) {
        logger.error(`Error starting game: ${err.message}`);
        socket.emit('error', { message: err.message });
      }
    });

    // add a ping-pong mechanism for connection health
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ status: 'ok', timestamp: Date.now() });
      }
    });

    socket.on('disconnect', async () => {
      try {
        // find all lobbies the user is in and remove them
        await multiplayerService.handlePlayerDisconnect(socket.user._id);
        logger.info(
          `Socket disconnected: ${socket.id} - User: ${socket.user.email}`
        );
      } catch (err) {
        logger.error(`Error handling disconnect: ${err.message}`);
      }
    });
  });

  return io;
};

// get the io instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  init,
  getIO,
};
