const mongoose = require('mongoose');

const dailySongSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  song: {
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album_cover: { type: String },
    preview_url: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DailySong', dailySongSchema);
