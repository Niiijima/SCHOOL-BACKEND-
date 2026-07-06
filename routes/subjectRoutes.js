const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');

const { restrictTo } = require('../middleware/auth'); 

// Admin only route to create a subject
router.post('/create', restrictTo('admin'), subjectController.createSubject);

// Teachers and Admins can view the subject list
router.get('/', restrictTo('admin', 'teacher'), subjectController.getAllSubjects);

module.exports = router;