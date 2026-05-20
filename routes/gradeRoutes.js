const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { restrictTo } = require('../middleware/auth'); // Adjust path to your auth middleware if needed

// Route to load the student list when a teacher chooses a class
router.get('/subject/:subjectId/students', restrictTo('teacher', 'admin'), gradeController.getStudentsBySubject);

// Route to submit the score input sheet
router.post('/submit-scores', restrictTo('teacher'), gradeController.submitStudentScores);

// Route for the admin to lock/unlock score submission for a specific term
router.post('/toggle-lock', restrictTo('admin'), gradeController.toggleTermLock);

// Route to view a comprehensive student dashboard overview grouped by term and annual averages
router.get('/student/:studentId/academic-profile', restrictTo('admin', 'teacher', 'student'), gradeController.getStudentAcademicProfile);

// NEW: Route to fetch dynamic class performance metrics (e.g., class size strength and positioning)
router.get('/class-metrics', restrictTo('admin', 'teacher'), gradeController.getClassPerformanceMetrics);

module.exports = router;