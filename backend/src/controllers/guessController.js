const logger = require('../config/logger');
const axios = require('axios');
const { getSpotifyToken } = require('../services/spotifyService');

/**
 * POST /guess
 * Checks a user's guess for a song against the actual song data from Spotify.
 */
async function guessSong(req, res) {
  try {
    const { songId, guess } = req.body;
    if (!songId || !guess) {
      return res.status(400).json({ error: "Missing songId or guess" });
    }

    const token = await getSpotifyToken();
    const response = await axios.get(`https://api.spotify.com/v1/tracks/${songId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const actualSongName = response.data.name.toLowerCase();
    const userGuess = guess.toLowerCase();
    const isCorrect = actualSongName === userGuess;

    if (isCorrect) {
      // Build an object with song details, including album cover
      const songInfo = {
        name: response.data.name,
        artist: response.data.artists.map((a) => a.name).join(", "),
        album_cover: response.data.album.images[0].url,
      };
      res.json({
        correct: true,
        song: songInfo,
      });
    } else {
      res.json({ correct: false });
    }
  } catch (err) {
    logger.error(`Error processing guess: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  guessSong,
};
