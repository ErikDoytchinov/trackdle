const moment = require('moment');
const DailySong = require('../models/dailySongModel');
const { getRandomTracks } = require('../services/sessionService');
const { getDeezerPreview } = require('../services/deezerService');
const logger = require('../config/logger');

async function generateDailySong() {
  const today = moment().utc().format('YYYY-MM-DD');

  const existing = await DailySong.findOne({ date: today });
  if (existing) {
    logger.info(`Daily song for ${today} already exists.`);
    return;
  }

  // get a random song from your pool
  const tracks = await getRandomTracks();
  let target = null;
  for (const track of tracks) {
    const preview = await getDeezerPreview(track.name, track.artist);
    if (preview) {
      target = { ...track, preview_url: preview };
      break;
    }
  }

  if (!target) {
    logger.error(
      'Could not find a song with a valid preview for the daily song.'
    );
    return;
  }

  const dailySong = new DailySong({
    date: today,
    song: {
      title: target.name,
      artist: target.artist,
      album_cover: target.album_cover,
      preview_url: target.preview_url,
    },
  });

  await dailySong.save();
  logger.info(`Daily song for ${today} has been generated.`);
}

module.exports = generateDailySong;
