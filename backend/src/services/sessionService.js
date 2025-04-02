const Session = require('../models/sessionModel');
const SongPool = require('../models/songPoolModel');
const { getCachedPlaylistTracks } = require('./spotifyService');
const { getDeezerPreview } = require('./deezerService');
const User = require('../models/userModel');

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Returns a list of random tracks from the SongPool collection.
 * It uses MongoDB's $sample operator to pick a random set of songs.
 */
async function getRandomTracks() {
  // Sample 10 random documents (adjust the size as needed)
  const randomDocs = await SongPool.aggregate([{ $sample: { size: 100 } }]);
  // Map the documents to track objects similar to fetchBasicPlaylistTracks output
  return randomDocs.map((doc) => ({
    name: doc.song.title,
    artist: doc.song.artist,
    album_cover: doc.song.album_cover,
  }));
}

/**
 * Creates a new session.
 * If mode is 'playlist', uses the provided playlist URL and adds the songs to the SongPool (uniquely);
 * if mode is 'random', fetches a list of random tracks from the SongPool.
 * Returns an object containing the session document and the list of tracks.
 */
async function createSession(mode, playlist_url) {
  let tracks;
  if (mode === 'playlist') {
    // Fetch tracks from the provided playlist URL
    tracks = await getCachedPlaylistTracks(playlist_url);
    // Upsert each track into SongPool to ensure uniqueness
    for (const track of tracks) {
      await SongPool.findOneAndUpdate(
        { 'song.title': track.name, 'song.artist': track.artist },
        {
          $setOnInsert: {
            song: {
              title: track.name,
              artist: track.artist,
              album_cover: track.album_cover,
            },
          },
        },
        { upsert: true, new: true }
      );
    }
  } else if (mode === 'random') {
    tracks = await getRandomTracks();
  } else {
    throw new Error('Invalid mode provided.');
  }

  if (!tracks.length) {
    throw new Error('No tracks found.');
  }

  // Shuffle tracks and pick the first track with a valid preview.
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
    throw new Error('No target track with a preview found.');
  }

  // Create session document with mode and target info.
  const session = new Session({
    mode,
    status: 'in-progress',
    // Include playlist_url only for playlist mode.
    playlist_url: mode === 'playlist' ? playlist_url : undefined,
    targetPreview: target.preview_url,
    targetSong: {
      title: target.name,
      artist: target.artist,
      album_cover: target.album_cover,
    },
    attempts: 0,
    hintLevel: 0,
    userId: 'user123', // Replace with real user info if needed.
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
 * Updates a session with a new target track.
 * For 'playlist' mode, uses the playlist URL;
 * for 'random' mode, fetches a random track from the SongPool.
 */
async function nextTarget(session_id) {
  const session = await getSessionById(session_id);
  if (!session) {
    throw new Error('Session not found.');
  }
  if (session.status === 'completed') {
    session.status = 'in-progress';
    await session.save();
  }

  let tracks;
  if (session.mode === 'playlist') {
    if (!session.playlist_url) {
      throw new Error('Session does not have an associated playlist URL.');
    }
    tracks = await getCachedPlaylistTracks(session.playlist_url);
  } else if (session.mode === 'random') {
    tracks = await getRandomTracks();
  }
  if (!tracks.length) {
    throw new Error('No tracks found.');
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
    throw new Error('No track with a preview available.');
  }
  session.targetPreview = newTarget.preview_url;
  session.targetSong = {
    title: newTarget.name,
    artist: newTarget.artist,
    album_cover: newTarget.album_cover,
  };
  session.attempts = 0;
  session.hintLevel = 0;
  await session.save();
  return session;
}

async function updateUserStats(
  userId,
  currentGameAttempts,
  currentGamePlaytime,
  wonGame
) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.gamesPlayed += 1;
  user.totalAttempts = (user.totalAttempts || 0) + currentGameAttempts;
  user.totalPlaytime = (user.totalPlaytime || 0) + currentGamePlaytime;
  if (wonGame) {
    user.correctGuesses += 1;
  }

  user.averageAttempts = user.totalAttempts / user.gamesPlayed;
  user.winRate = (user.correctGuesses / user.gamesPlayed) * 100;

  await user.save();
  return user;
}

module.exports = { createSession, getSessionById, nextTarget, updateUserStats };
