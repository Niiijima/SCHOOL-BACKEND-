const express = require('express');
const router = express.Router();

const gradeController = require('../controllers/gradeController');

// Temporarily remove middleware to test
router.get('/subject/:subjectId/students', gradeController.getStudentsBySubject);
router.post('/submit-scores', gradeController.submitStudentScores);
router.post('/toggle-lock', gradeController.toggleTermLock);
router.get('/student/:studentId/academic-profile', gradeController.getStudentAcademicProfile);

console.log(" Grade Routes Loaded Successfully");

module.exports = router;