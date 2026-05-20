const express = require('express');
const router = express.Router();

// Test Route
router.get('/test', (req, res) => {
    res.send('Admin route is working!');
});

module.exports = router;