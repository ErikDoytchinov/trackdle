const mongoose = require('mongoose');

const songPoolSchema = new mongoose.Schema({
  song: {
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album_cover: { type: String, required: false },
  },
});

module.exports = mongoose.model('SongPool', songPoolSchema);
