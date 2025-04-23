const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  ready: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
});

const multiplayerLobbySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  players: [playerSchema],
  status: {
    type: String,
    enum: ['waiting', 'in-game', 'completed'],
    default: 'waiting',
  },
  gameSettings: {
    songCount: { type: Number, default: 5 },
    maxAttempts: { type: Number, default: 5 },
  },
  activeGameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultiplayerGame',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('MultiplayerLobby', multiplayerLobbySchema);
