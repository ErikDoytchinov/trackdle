const axios = require('axios');
const logger = require('../config/logger');

const deezerPreviewCache = new Map();

/**
 * Get Deezer preview for a given song.
 * Caches results to prevent repeated lookups.
 * If an exact match is not found, returns null.
 */
async function getDeezerPreview(songName, artistName) {
  const queryKey = `${songName} ${artistName}`;

  // Check our cache
  if (deezerPreviewCache.has(queryKey)) {
    return deezerPreviewCache.get(queryKey);
  }

  try {
    logger.info(`Fetching Deezer preview for "${songName}" by "${artistName}"`);

    // Use advanced query syntax to narrow down results
    const queryString = `track:"${songName}" artist:"${artistName}"`;
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(queryString)}`;

    // Set a 1000ms timeout for the request
    const response = await axios.get(searchUrl, { timeout: 1000 });

    if (response.data?.data?.length) {
      const results = response.data.data;
      let exactMatch = null;

      // Look for an exact match (case-insensitive) on both track title and artist name
      for (const track of results) {
        if (
          track.title &&
          track.artist &&
          track.title.toLowerCase() === songName.toLowerCase() &&
          track.artist.name.toLowerCase() === artistName.toLowerCase()
        ) {
          exactMatch = track;
          break;
        }
      }

      // Only use the preview if an exact match is found
      if (exactMatch) {
        const preview = exactMatch.preview;
        deezerPreviewCache.set(queryKey, preview);
        return preview;
      }
    }

    // No exact match found
    deezerPreviewCache.set(queryKey, null);
    return null;
  } catch (err) {
    logger.warn(
      `Deezer preview fetch failed for "${songName}" by "${artistName}": ${err.message}`
    );
    deezerPreviewCache.set(queryKey, null);
    return null;
  }
}

module.exports = {
  getDeezerPreview,
};
