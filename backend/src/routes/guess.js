const express = require('express');
const router = express.Router();
const { guessSong } = require('../controllers/guessController');

router.post('/', guessSong);

module.exports = router;
