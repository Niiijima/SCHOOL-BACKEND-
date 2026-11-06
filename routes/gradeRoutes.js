const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { protect, restrictTo } = require('../middleware/auth');

// Submit scores – only admin (or admin + teacher if needed)
router.post(
    '/submit-scores',
    protect,
    restrictTo('admin', 'teacher'),         
    gradeController.submitStudentScores
);

// Toggle term lock – admin only
router.patch(
    '/admin/toggle-lock',
    protect,
    restrictTo('admin'),
    gradeController.toggleTermLock
);

// Academic profile – any logged-in user (controller still enforces ownership)
router.get(
    '/student/:studentId/academic-profile',
    protect,
    gradeController.getStudentAcademicProfile
);

// Optional: students by subject
router.get(
    '/subject/:subjectId/students',
    protect,
    restrictTo('admin', 'teacher'),
    gradeController.getStudentsBySubject
);

module.exports = router;