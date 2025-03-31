const express = require('express');
const router = express.Router();
const { postSession, getSession, postGuess, postNextTarget } = require('../controllers/sessionController');

router.post('/', postSession);
router.get('/:session_id', getSession);
router.post('/:session_id/guess', postGuess);
router.post('/:session_id/next', postNextTarget);

module.exports = router;
