const axios = require('axios');
const logger = require('../config/logger');

const deezerPreviewCache = new Map();

/**
 * Get Deezer preview for a given song.
 * Caches results to prevent repeated lookups.
 * If Deezer request times out or fails, returns null.
 */
async function getDeezerPreview(songName, artistName) {
  const query = `${songName} ${artistName}`;

  // Check our cache
  if (deezerPreviewCache.has(query)) {
    return deezerPreviewCache.get(query);
  }

  try {
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}`;
    // Set a 1000ms timeout for Deezer requests
    const response = await axios.get(searchUrl, { timeout: 1000 });

    if (response.data?.data?.length) {
      const preview = response.data.data[0].preview;
      deezerPreviewCache.set(query, preview);
      return preview;
    }
    // If no track found
    deezerPreviewCache.set(query, null);
    return null;
  } catch (err) {
    logger.warn(
      `Deezer preview fetch failed for "${songName}" by "${artistName}": ${err.message}`
    );
    deezerPreviewCache.set(query, null);
    return null;
  }
}

module.exports = {
  getDeezerPreview,
};
