const express = require('express');
const router = express.Router();

const gradeController = require('../controllers/gradeController');
const { protect, restrictTo } = require('../middleware/auth');

// ---------- Submit scores ----------
router.post(
  '/submit-scores',
  protect,
  restrictTo('admin', 'teacher'),
  gradeController.submitStudentScores
);

router.post(
  '/submit-multiple-scores',
  protect,
  restrictTo('admin', 'teacher'),
  gradeController.submitMultipleStudentScores
);

router.post(
  '/submit-ca',
  protect,
  restrictTo('admin', 'teacher'),
  gradeController.submitCAScores
);

router.post(
  '/submit-exam',
  protect,
  restrictTo('admin', 'teacher'),
  gradeController.submitExamScores
);

// ---------- Admin term controls ----------
router.patch(
  '/admin/publish-results',
  protect,
  restrictTo('admin'),
  gradeController.publishTermResults
);

router.patch(
  '/admin/publish',
  protect,
  restrictTo('admin'),
  gradeController.publishTermResults
);

router.patch(
  '/admin/toggle-lock',
  protect,
  restrictTo('admin'),
  gradeController.toggleTermLock
);

router.get(
  '/admin/term-statuses',
  protect,
  restrictTo('admin'),
  gradeController.getTermStatuses
);

// ---------- Individual student result locks ----------
router.patch(
  '/admin/student-result-lock',
  protect,
  restrictTo('admin'),
  gradeController.setStudentResultLock
);

router.get(
  '/admin/student-result-locks',
  protect,
  restrictTo('admin'),
  gradeController.getStudentResultLocks
);

// ---------- Reads ----------
router.get(
  '/student/:studentId/academic-profile',
  protect,
  gradeController.getStudentAcademicProfile
);

router.get(
  '/subject/:subjectId/students',
  protect,
  restrictTo('admin', 'teacher'),
  gradeController.getStudentsBySubject
);

router.get(
  '/',
  protect,
  restrictTo('admin', 'teacher'),
  gradeController.getAllGrades
);

module.exports = router;