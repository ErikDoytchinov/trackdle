const express = require('express');
const router = express.Router();
const { getDailyStatus } = require('../controllers/dailyController');
const { optionalProtect } = require('../../middleware/optionalMiddleware');

router.get('/status', optionalProtect, getDailyStatus);

module.exports = router;
