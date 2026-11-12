const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/auth'); // optional – can be public

router.get('/current-year', settingsController.getCurrentYear);

module.exports = router;