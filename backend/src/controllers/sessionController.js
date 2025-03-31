const logger = require('../config/logger');
const { createSession, getSessionById, nextTarget } = require('../services/sessionService');

/**
 * POST /session
 * Creates a new session and returns its ID along with the list of tracks.
 */
async function postSession(req, res) {
  try {
    // Read mode and playlist_url from the request; default mode to 'playlist'
    const { mode = 'playlist', playlist_url } = req.body;
    if (mode === 'playlist' && !playlist_url) {
      return res.status(400).json({ error: "Missing playlist URL" });
    }
    logger.info(`Creating new session with mode: ${mode}${playlist_url ? ` for playlist: ${playlist_url}` : ''}`);
    // createSession now accepts mode and (optionally) playlist_url.
    const { session, tracks } = await createSession(mode, playlist_url);
    logger.info(`Created new session with ID: ${session._id}`);
    res.json({ session_id: session._id, tracks });
  } catch (err) {
    logger.error(`Error creating session: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /session/:session_id
 * Returns session details including only the preview.
 */
async function getSession(req, res) {
  try {
    const { session_id } = req.params;
    if (!session_id) {
      return res.status(400).json({ error: "Missing session ID" });
    }
    logger.info(`Fetching session details for ID: ${session_id}`);
    const session = await getSessionById(session_id);
    if (!session) {
      logger.warn("Session not found.");
      return res.status(404).json({ error: "Session not found." });
    }
    // Remove targetSong so the frontend sees only the preview.
    const sessionObj = session.toObject();
    delete sessionObj.targetSong;
    logger.info(`Fetched session with ID: ${session_id}`);
    res.json({ session: sessionObj });
  } catch (err) {
    logger.error(`Error fetching session: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

async function postGuess(req, res) {
  try {
    const { session_id } = req.params;
    const { guess, skip } = req.body;
    if (!session_id || (guess === undefined && !skip)) {
      return res.status(400).json({ error: "Missing session ID or guess/skip flag" });
    }
    const session = await getSessionById(session_id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (skip) {
      session.attempts += 1;
      session.hintLevel += 1;
      await session.save();
      if (session.attempts >= 5) {
        // Reveal answer after 5 attempts/skips.
        const songInfo = {
          name: session.targetSong.title,
          artist: session.targetSong.artist,
          album_cover: session.targetSong.album_cover,
          preview_url: session.targetPreview
        };
        return res.json({ correct: true, song: songInfo, skipped: true });
      } else {
        return res.json({ correct: false, skip: true, hintLevel: session.hintLevel });
      }
    } else {
      // Process a normal guess
      const correctTitle = session.targetSong.title.toLowerCase().trim();
      const userGuess = guess.toLowerCase().trim();
      if (userGuess === correctTitle) {
        const songInfo = {
          name: session.targetSong.title,
          artist: session.targetSong.artist,
          album_cover: session.targetSong.album_cover,
          preview_url: session.targetPreview
        };
        return res.json({ correct: true, song: songInfo });
      } else {
        session.attempts += 1;
        await session.save();
        if (session.attempts >= 5) {
          const songInfo = {
            name: session.targetSong.title,
            artist: session.targetSong.artist,
            album_cover: session.targetSong.album_cover,
            preview_url: session.targetPreview
          };
          return res.json({ correct: true, song: songInfo });
        }
        return res.json({ correct: false, hintLevel: session.hintLevel });
      }
    }
  } catch (err) {
    logger.error(`Error processing guess: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /session/:session_id/next
 * Updates the session with a new target track and returns its preview.
 */
async function postNextTarget(req, res) {
  try {
    const { session_id } = req.params;
    if (!session_id) {
      return res.status(400).json({ error: "Missing session ID" });
    }
    logger.info(`Updating session with a new target for session ID: ${session_id}`);
    const session = await nextTarget(session_id);
    logger.info(`Updated session with new target for session ID: ${session_id}`);
    res.json({ track: { preview_url: session.targetPreview } });
  } catch (err) {
    logger.error(`Error updating session: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { postSession, getSession, postGuess, postNextTarget };
