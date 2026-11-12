const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { protect, restrictTo } = require('../middleware/auth');

// All subject routes require authentication.
router.use(protect);

// Get all subjects.
router.get(
    '/',
    restrictTo('admin', 'teacher'),
    subjectController.getAllSubjects
);

// Create one subject.
router.post(
    '/',
    restrictTo('admin'),
    subjectController.createSubject
);

// Alternative subject creation endpoint.
router.post(
    '/create',
    restrictTo('admin'),
    subjectController.createSubject
);

// Create multiple subjects.
router.post(
    '/bulk',
    restrictTo('admin'),
    subjectController.createSubjectBulk
);

// Update an existing subject's class and department assignments.
router.patch(
    '/:subjectId/assignments',
    restrictTo('admin'),
    subjectController.updateSubjectAssignments
);

// Enroll a student in a subject.
router.post(
    '/enroll',
    restrictTo('admin', 'teacher'),
    subjectController.enrollStudent
);

module.exports = router;