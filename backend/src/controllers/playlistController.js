const logger = require('../config/logger');
const { fetchBasicPlaylistTracks } = require('../services/spotifyService');
const { getDeezerPreview } = require('../services/deezerService');

/**
 * GET /playlist
 * Returns basic track info (id, name, artist) from the provided Spotify playlist URL.
 */
async function getPlaylist(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing playlist URL" });
    }
    logger.info(`Fetching basic playlist tracks from: ${url}`);
    const tracks = await fetchBasicPlaylistTracks(url);
    if (!tracks.length) {
      logger.warn("No tracks found in the playlist.");
      return res.status(404).json({ error: "No tracks available." });
    }
    logger.info(`Fetched ${tracks.length} tracks from playlist.`);
    res.json({ tracks });
  } catch (err) {
    logger.error(`Error fetching playlist tracks: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /playlist/target
 * Chooses a target track (with a Deezer preview) from the given list of tracks.
 */
async function getTargetTrack(req, res) {
  try {
    const tracks = req.body.tracks;
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "No tracks provided." });
    }

    // Clone and shuffle the tracks using Fisher-Yates algorithm
    const shuffledTracks = shuffleArray([...tracks]);

    let target = null;
    // Try each track until one with a preview is found
    for (let track of shuffledTracks) {
      const preview_url = await getDeezerPreview(track.name, track.artist);
      if (preview_url) {
        target = { ...track, preview_url };
        break;
      }
    }

    if (!target) {
      logger.warn("No track with a preview found.");
      return res.status(404).json({ error: "No tracks with previews available." });
    }

    logger.info(`Selected target track: ${target.name} by ${target.artist}`);
    res.json({ track: target });
  } catch (err) {
    logger.error(`Error selecting target track: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Fisher-Yates Shuffle Algorithm
 * Shuffles an array in place and returns it.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index from 0 to i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));
    // Swap elements at indices i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


module.exports = {
  getPlaylist,
  getTargetTrack,
};
