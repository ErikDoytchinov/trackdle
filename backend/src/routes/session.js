const express = require('express');
const router = express.Router();
const { postSession, getSession, postGuess, postNextTarget } = require('../controllers/sessionController');
const { optionalProtect } = require('../../middleware/optionalMiddleware');

router.post('/', optionalProtect, postSession);
router.get('/:session_id', getSession);
router.post('/:session_id/guess', optionalProtect, postGuess);
router.post('/:session_id/next', optionalProtect, postNextTarget);

module.exports = router;
