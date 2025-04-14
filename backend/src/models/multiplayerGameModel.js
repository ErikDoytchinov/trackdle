const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  name: { type: String, required: true },
  artist: { type: String, required: true },
  album_cover: { type: String },
});

const targetSongSchema = new mongoose.Schema({
  name: { type: String, required: true },
  artist: { type: String, required: true },
  album_cover: { type: String },
  preview_url: { type: String, required: true },
});

const completedSongSchema = new mongoose.Schema({
  songIndex: { type: Number, required: true },
  correct: { type: Boolean, required: true },
  attempts: { type: Number, required: true },
});

const playerStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userEmail: { type: String, required: true },
  currentSongIndex: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  completedSongs: [completedSongSchema],
  currentSongAttempts: { type: Number, default: 0 },
});

const multiplayerGameSchema = new mongoose.Schema({
  lobbyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultiplayerLobby',
    required: true,
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed'],
    default: 'in-progress',
  },
  songs: [songSchema],
  targetSongs: [targetSongSchema],
  playerStates: [playerStateSchema],
  maxAttempts: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

module.exports = mongoose.model('MultiplayerGame', multiplayerGameSchema);
