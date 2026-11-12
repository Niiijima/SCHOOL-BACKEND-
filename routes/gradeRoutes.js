
const express = require('express');
const router = express.Router();

const gradeController = require('../controllers/gradeController');
const { protect, restrictTo } = require('../middleware/auth');

// Submit scores — admin and teacher only
router.post(
    '/submit-scores',
    protect,
    restrictTo('admin', 'teacher'),
    gradeController.submitStudentScores
);

// Publish or unpublish results — admin only
router.patch(
    '/admin/publish-results',
    protect,
    restrictTo('admin'),
    gradeController.publishTermResults
);

// Toggle term lock — admin only
router.patch(
    '/admin/toggle-lock',
    protect,
    restrictTo('admin'),
    gradeController.toggleTermLock
);

// Student academic profile
router.get(
    '/student/:studentId/academic-profile',
    protect,
    gradeController.getStudentAcademicProfile
);

// Students by subject — admin and teacher only
router.get(
    '/subject/:subjectId/students',
    protect,
    restrictTo('admin', 'teacher'),
    gradeController.getStudentsBySubject
);

// Get all grades — admin and teacher only
router.get(
    '/',
    protect,
    restrictTo('admin', 'teacher'),
    gradeController.getAllGrades
);

// Get term publication and lock statuses — admin only
router.get(
    '/admin/term-statuses',
    protect,
    restrictTo('admin'),
    gradeController.getTermStatuses
);

// Submit multiple subject scores for one student
router.post(
    '/submit-multiple-scores',
    protect,
    restrictTo('admin', 'teacher'),
    gradeController.submitMultipleStudentScores
);

router.patch(
  '/admin/toggle-lock',
  restrictTo('admin'),
  gradeController.toggleTermLock
);

router.patch(
  '/admin/publish',
  restrictTo('admin'),
  gradeController.publishTermResults
);

router.get(
  '/admin/term-statuses',
  restrictTo('admin'),
  gradeController.getTermStatuses
);

router.patch(
  '/admin/student-result-lock',
  restrictTo('admin'),
  gradeController.setStudentResultLock
);

router.get(
  '/admin/student-result-locks',
  restrictTo('admin'),
  gradeController.getStudentResultLocks
);

module.exports = router;
