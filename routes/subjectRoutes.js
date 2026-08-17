const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');

const { restrictTo } = require('../middleware/auth'); 

// Temporarily removed auth for testing
router.post('/create', subjectController.createSubject);

// Teachers and Admins can view the subject list
router.get('/', restrictTo('admin', 'teacher'), subjectController.getAllSubjects);

module.exports = router;