const mongoose = require('mongoose');

//     "sessionId": "abc123",
//     "mode": "playlist",
//     "status": "in-progress",
//     "playlist_url": "https://spotify-playlist-url",
//     "targetPreview": "https://deezer-preview-url.mp3",
//     "targetSong": {
//        "title": "Song Title",
//        "artist": "Artist Name"
//        "album_cover": "https://album-cover-url.jpg"
//      },
//     "attempts": 1,
//     "hintLevel": 0
//     "created_at": "2021-10-01T12:00:00Z"
//     "userId": "user123"

const sessionSchema = new mongoose.Schema({
  mode: {
    type: String,
    required: true,
    enum: ['playlist', 'random', 'daily'],
  },
  status: {
    type: String,
    required: true,
    enum: ['in-progress', 'completed'],
  },
  playlist_url: {
    type: String,
    required: function () {
      return this.mode === 'playlist';
    },
  },
  targetPreview: {
    type: String,
    required: false,
  },
  targetSong: {
    title: { type: String, required: false },
    artist: { type: String, required: false },
    album_cover: { type: String, required: false },
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
  },
  hintLevel: {
    type: Number,
    required: true,
    default: 0,
  },
  created_at: {
    type: Date,
    required: true,
    default: Date.now,
  },
  userId: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model('Session', sessionSchema);
