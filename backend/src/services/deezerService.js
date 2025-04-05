const axios = require('axios');
const logger = require('../config/logger');
const NodeCache = require('node-cache');

const cacheTTLSeconds = 20 * 60; // 20 minutes in seconds
const deezerPreviewCache = new NodeCache({ stdTTL: cacheTTLSeconds });

/**
 * Get Deezer preview for a given song.
 * Caches results to prevent repeated lookups.
 * If an exact match is not found, returns null.
 */
async function getDeezerPreview(songName, artistName) {
  const queryKey = `${songName} ${artistName}`;

  const cachedPreview = deezerPreviewCache.get(queryKey);
  if (cachedPreview !== undefined) {
    return cachedPreview;
  }

  try {
    logger.info(`Fetching Deezer preview for "${songName}" by "${artistName}"`);

    const queryString = `track:"${songName}" artist:"${artistName}"`;
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(queryString)}`;

    const { data } = await axios.get(searchUrl, { timeout: 1000 });

    if (data?.data?.length) {
      const exactMatch = data.data.find(
        (track) =>
          track.title &&
          track.artist &&
          track.title.toLowerCase() === songName.toLowerCase() &&
          track.artist.name.toLowerCase() === artistName.toLowerCase()
      );

      if (exactMatch) {
        const preview = exactMatch.preview;
        deezerPreviewCache.set(queryKey, preview);
        return preview;
      }
    }
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
