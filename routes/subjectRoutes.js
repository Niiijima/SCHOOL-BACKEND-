const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');

// Import your restriction middleware from your auth/student file setup
// Adjust this path if your middleware is located elsewhere
const { restrictTo } = require('../middleware/auth'); 

// Admin only route to create a subject
router.post('/create', restrictTo('admin'), subjectController.createSubject);

// Teachers and Admins can view the subject list
router.get('/', restrictTo('admin', 'teacher'), subjectController.getAllSubjects);

module.exports = router;