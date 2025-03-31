const express = require('express');
const router = express.Router();

const sessionRoutes = require('./session');

router.use('/session', sessionRoutes);

module.exports = router;