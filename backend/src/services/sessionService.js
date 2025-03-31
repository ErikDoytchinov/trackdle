// services/sessionService.js
const Session = require('../models/sessionModel');
const { fetchBasicPlaylistTracks } = require('./spotifyService');
const { getDeezerPreview } = require('./deezerService');

/**
 * Fisher-Yates Shuffle Algorithm
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Creates a new session for the given playlist URL.
 * Selects a target track that has a Deezer preview.
 * Returns an object containing the session document and the full list of tracks.
 */
async function createSession(playlist_url) {
  const tracks = await fetchBasicPlaylistTracks(playlist_url);
  if (!tracks.length) {
    throw new Error("No tracks found in the playlist.");
  }

  // Shuffle and pick the first track with a preview.
  const shuffledTracks = shuffleArray([...tracks]);
  let target = null;
  for (const track of shuffledTracks) {
    const preview = await getDeezerPreview(track.name, track.artist);
    if (preview) {
      target = { ...track, preview_url: preview };
      break;
    }
  }
  if (!target) {
    throw new Error("No target track with a preview found.");
  }

  // Create session document with full target info (which remains hidden)
  const session = new Session({
    mode: 'playlist',
    status: 'in-progress',
    playlist_url,
    targetPreview: target.preview_url,
    targetSong: {
      title: target.name,
      artist: target.artist,
      album_cover: target.album_cover
    },
    attempts: 0,
    hintLevel: 0,
    userId: 'user123' // Replace with real user info if needed.
  });
  await session.save();
  return { session, tracks };
}

/**
 * Retrieves a session by its ID.
 */
async function getSessionById(session_id) {
  return await Session.findById(session_id);
}

/**
 * Updates a session with a new target track (for a new round).
 */
async function nextTarget(session_id) {
  const session = await getSessionById(session_id);
  if (!session) {
    throw new Error("Session not found.");
  }
  if (!session.playlist_url) {
    throw new Error("Session does not have an associated playlist URL.");
  }
  const tracks = await fetchBasicPlaylistTracks(session.playlist_url);
  if (!tracks.length) {
    throw new Error("No tracks found in the playlist.");
  }
  const shuffledTracks = shuffleArray([...tracks]);
  let newTarget = null;
  for (const track of shuffledTracks) {
    const preview = await getDeezerPreview(track.name, track.artist);
    if (preview) {
      newTarget = { ...track, preview_url: preview };
      break;
    }
  }
  if (!newTarget) {
    throw new Error("No track with a preview available.");
  }
  session.targetPreview = newTarget.preview_url;
  session.targetSong = { title: newTarget.name, artist: newTarget.artist, album_cover: newTarget.album_cover };
  session.attempts = 0;
  session.hintLevel = 0;
  await session.save();
  return session;
}

module.exports = { createSession, getSessionById, nextTarget, shuffleArray };
