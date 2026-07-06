const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { restrictTo } = require('../middleware/auth'); 

// Admin only route to create a teacher
router.post('/create', restrictTo('admin'), teacherController.createTeacher);

router.get('/test', (req, res) => {
    res.send('Teacher route is working!');
});

module.exports = router;