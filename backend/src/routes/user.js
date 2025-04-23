const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/userController');
const { getDailyStatus } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { optionalProtect } = require('../middleware/optionalMiddleware');

router.get('/stats', protect, getStats);
router.get('/status', optionalProtect, getDailyStatus);

module.exports = router;
