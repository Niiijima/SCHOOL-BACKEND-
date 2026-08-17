const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { restrictTo } = require('../middleware/auth'); 

router.post('/create', teacherController.createTeacher);   // ← Removed restrictTo for testing

router.get('/test', (req, res) => {
    res.send('Teacher route is working!');
});

module.exports = router;