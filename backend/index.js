const express = require("express");
const axios = require("axios");
const morgan = require("morgan");
const winston = require("winston");
require("dotenv").config();

const app = express();

// Setup Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Setup middleware
app.use(morgan("combined"));
app.use(express.json());
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});


let spotifyTokenCache = null;
let spotifyTokenExpiresAt = 0;
const deezerPreviewCache = new Map();

/**
 * Get and cache Spotify API token.
 */
async function getSpotifyToken() {
  const now = Date.now();
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
    // Refresh one minute before expiration.
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
 * Get Deezer preview for a given song.
 * Uses a timeout to avoid long delays and caches results.
 */
async function getDeezerPreview(songName, artistName) {
  const query = `${songName} ${artistName}`;
  if (deezerPreviewCache.has(query)) {
    return deezerPreviewCache.get(query);
  }
  try {
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}`;
    // Set a timeout of 1000ms for Deezer requests.
    const response = await axios.get(searchUrl, { timeout: 1000 });
    if (response.data?.data?.length) {
      const preview = response.data.data[0].preview;
      deezerPreviewCache.set(query, preview);
      return preview;
    }
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

/**
 * Fetch basic playlist tracks from Spotify.
 * Returns an array of objects with id, name, and artist.
 */
async function fetchBasicPlaylistTracks(url) {
  // Extract playlist ID (expects URL like .../playlist/{playlistId}?...)
  const parts = url.split("/playlist/");
  if (parts.length < 2) throw new Error("Invalid playlist URL format");
  const playlistId = parts[1].split("?")[0];

  const token = await getSpotifyToken();
  const baseUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
  const limit = 100;
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
            album_cover: item.track.album.images[0].url,
          };
        })
        .filter(Boolean)
    );
    nextUrl = response.data.next;
  }
  return tracks;
}

/**
 * GET /playlist
 * Returns basic track info (id, name, artist) from the provided Spotify playlist URL.
 */
app.get("/playlist", async (req, res) => {
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
});

/**
 * GET /target
 * Chooses a target track (with a Deezer preview) from the provided Spotify playlist URL.
 * It selects a random track from the basic track list and tries to get a preview.
 * If the chosen track has no preview, it iterates through the list until one is found.
 */
app.post("/target", async (req, res) => {
  try {
    const tracks = req.body.tracks;
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "No tracks provided." });
    }
    // Shuffle the tracks randomly.
    const shuffledTracks = tracks.sort(() => Math.random() - 0.5);
    let target = null;
    // Try each track until one with a preview is found.
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
});


/**
 * POST /guess
 * Checks a user's guess for a song against the actual song.
 */
// In your server file (e.g., server.js)
app.post("/guess", async (req, res) => {
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
      // Build an object with song details, including album cover.
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
      res.json({
        correct: false,
      });
    }
  } catch (err) {
    logger.error(`Error processing guess: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Backend running on port ${PORT}`);
});
