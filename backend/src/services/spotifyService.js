const axios = require('axios');
const logger = require('../config/logger');
const NodeCache = require('node-cache');

let spotifyTokenCache = null;
let spotifyTokenExpiresAt = 0;

const playlistCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // TTL 10 minutes

async function getCachedPlaylistTracks(url) {
  let cachedTracks = playlistCache.get(url);
  if (cachedTracks) {
    return cachedTracks;
  }

  const tracks = await fetchBasicPlaylistTracks(url);
  playlistCache.set(url, tracks);
  return tracks;
}


/**
 * Get and cache Spotify API token.
 */
async function getSpotifyToken() {
  const now = Date.now();
  // If we have a cached token and it's not expired, return it
  if (spotifyTokenCache && now < spotifyTokenExpiresAt) {
    return spotifyTokenCache;
  }

  try {
    logger.info("Requesting Spotify API token...");
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;

    // Refresh one minute before actual expiration
    spotifyTokenCache = token;
    spotifyTokenExpiresAt = now + expiresIn * 1000 - 60000;

    logger.info("Spotify API token retrieved successfully.");
    return token;
  } catch (err) {
    logger.error(`Error getting Spotify token: ${err.message}`);
    throw new Error("Failed to retrieve Spotify token.");
  }
}

/**
 * Fetch basic playlist tracks from Spotify.
 * Returns an array of { id, name, artist, album_cover } objects.
 */
async function fetchBasicPlaylistTracks(url) {
  // Extract playlist ID from URL: expects .../playlist/{playlistId}?...
  const parts = url.split("/playlist/");
  if (parts.length < 2) throw new Error("Invalid playlist URL format");
  const playlistId = parts[1].split("?")[0];

  const token = await getSpotifyToken();
  const baseUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
  const limit = 100; // max tracks per request
  const headers = { Authorization: `Bearer ${token}` };

  let tracks = [];
  let nextUrl = `${baseUrl}?limit=${limit}`;

  while (nextUrl) {
    const response = await axios.get(nextUrl, { headers });
    const items = response.data.items;

    tracks.push(
      ...items
        .map((item) => {
          if (!item.track) return null;
          return {
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists.map((a) => a.name).join(", "),
            album_cover: item.track.album.images[0]?.url,
          };
        })
        .filter(Boolean)
    );

    // If Spotify has more than 100 items, response.data.next will be the next page
    nextUrl = response.data.next;
  }

  return tracks;
}

module.exports = {
  getSpotifyToken,
  getCachedPlaylistTracks,
};
