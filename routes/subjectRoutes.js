const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

// List
router.get('/', restrictTo('admin', 'teacher'), subjectController.getAllSubjects);

// Single create
router.post('/', restrictTo('admin'), subjectController.createSubject);
router.post('/create', restrictTo('admin'), subjectController.createSubject);

// Bulk create (same subject for many classes)
router.post('/bulk', restrictTo('admin'), subjectController.createSubjectBulk);

// Enroll
router.post('/enroll', restrictTo('admin', 'teacher'), subjectController.enrollStudent);

module.exports = router;