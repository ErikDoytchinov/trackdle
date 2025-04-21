const Session = require('../models/sessionModel');
const SongPool = require('../models/songPoolModel');
const { getCachedPlaylistTracks } = require('./spotifyService');
const { getDeezerPreview } = require('./deezerService');
const User = require('../models/userModel');
const moment = require('moment');
const DailySong = require('../models/dailySongModel');

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
 * @param {number} sampleSize - Number of tracks to sample (default: 1000)
 */
async function getRandomTracks(sampleSize = 1000) {
  const randomDocs = await SongPool.aggregate([
    { $sample: { size: sampleSize } },
  ]);
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
 * If mode is 'daily', ensures the user can play and uses the daily song from DailySong.
 * Returns an object containing the session document and the list of tracks (if applicable).
 */
async function createSession(mode, playlist_url, req) {
  let target;
  let tracks = [];

  if (mode === 'daily') {
    if (!req.user) {
      throw new Error('Authentication required for daily mode.');
    }
    if (!req.user.canPlayDaily) {
      throw new Error('Daily game already played today.');
    }

    const todayKey = moment().utc().format('YYYY-MM-DD');
    const dailyRecord = await DailySong.findOne({ date: todayKey });
    if (!dailyRecord) {
      throw new Error('Daily song not available.');
    }

    // check if the preview URL is older than 1 hour based on the document's createdAt field.
    if (moment().diff(moment(dailyRecord.createdAt), 'minutes') >= 30) {
      const newPreview = await getDeezerPreview(
        dailyRecord.song.title,
        dailyRecord.song.artist
      );
      if (newPreview) {
        dailyRecord.song.preview_url = newPreview;
        dailyRecord.createdAt = new Date();
        await dailyRecord.save();
      }
    }

    req.user.canPlayDaily = false;
    await req.user.save();

    target = {
      name: dailyRecord.song.title,
      artist: dailyRecord.song.artist,
      album_cover: dailyRecord.song.album_cover,
      preview_url: dailyRecord.song.preview_url,
    };
    tracks = await getRandomTracks();
    const exists = tracks.some(
      (t) => t.name === target.name && t.artist === target.artist
    );
    if (!exists) {
      tracks.push({
        name: target.name,
        artist: target.artist,
        album_cover: target.album_cover,
        preview_url: target.preview_url,
      });
    }
    tracks = shuffleArray(tracks);
  } else if (mode === 'playlist') {
    const allTracks = await getCachedPlaylistTracks(playlist_url);
    // filter tracks by popularity (Spotify popularity score is 0-100)
    const popularityThreshold = 60;
    const popularTracks = allTracks.filter(
      (track) => track.popularity && track.popularity >= popularityThreshold
    );

    console.log(
      `Filtered playlist tracks: ${allTracks.length} total, ${popularTracks.length} meet popularity threshold`
    );

    tracks = allTracks;

    // only add popular tracks to the song pool
    for (const track of popularTracks) {
      await SongPool.findOneAndUpdate(
        { 'song.title': track.name, 'song.artist': track.artist },
        {
          $setOnInsert: {
            song: {
              title: track.name,
              artist: track.artist,
              album_cover: track.album_cover,
              popularity: track.popularity,
            },
          },
        },
        { upsert: true }
      );
    }
    if (!tracks.length) {
      throw new Error('No tracks found.');
    }
    const shuffledTracks = shuffleArray([...tracks]);
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
    if (
      !tracks.some((t) => t.name === target.name && t.artist === target.artist)
    ) {
      tracks.push(target);
    }
  } else if (mode === 'random') {
    tracks = await getRandomTracks();
    if (!tracks.length) {
      throw new Error('No tracks found.');
    }
    const shuffledTracks = shuffleArray([...tracks]);
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
    if (
      !tracks.some((t) => t.name === target.name && t.artist === target.artist)
    ) {
      tracks.push(target);
    }
  } else {
    throw new Error('Invalid mode provided.');
  }

  const session = new Session({
    mode,
    status: 'in-progress',
    playlist_url: mode === 'playlist' ? playlist_url : undefined,
    targetPreview: target.preview_url,
    targetSong: {
      title: target.name,
      artist: target.artist,
      album_cover: target.album_cover,
    },
    attempts: 0,
    hintLevel: 0,
    userId: req.user ? req.user._id : null,
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
  return { session, tracks };
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

module.exports = {
  createSession,
  getSessionById,
  nextTarget,
  updateUserStats,
  getRandomTracks,
};
