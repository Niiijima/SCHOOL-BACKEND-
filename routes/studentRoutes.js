const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const upload = require('../config/multer');
const { protect, restrictTo } = require('../middleware/auth');

// ====================== PUBLIC ROUTES ======================
router.get('/test', (req, res) => {
    res.send('Student route is working!');
});

router.post('/login', studentController.loginStudent);

// ====================== ADMIN ONLY ======================
router.post(
    '/register',
    protect,
    restrictTo('admin'),
    upload.single('image'),
    studentController.registerStudent
);

router.post(
    '/promote',
    protect,
    restrictTo('admin'),
    studentController.promoteStudent
);

router.post(
    '/bulk-promote',
    protect,
    restrictTo('admin'),
    studentController.bulkPromoteStudents
);

router.put(
    '/:id',
    protect,
    restrictTo('admin'),
    upload.single('image'),
    studentController.updateStudent
);

router.delete(
    '/:id',
    protect,
    restrictTo('admin'),
    studentController.deleteStudent
);

// ====================== ADMIN + TEACHER ======================
router.get(
    '/',
    protect,
    restrictTo('admin', 'teacher'),
    studentController.getAllStudents
);

// ====================== STUDENT PROFILE ======================
// IMPORTANT: these must come BEFORE /:id
router.get(
    '/profile/me',
    protect,
    restrictTo('student'),
    studentController.getMyProfile
);

router.get(
    '/profile/:id',
    protect,
    restrictTo('admin', 'teacher'),
    studentController.getMyProfile
);

// ====================== GET STUDENT BY ID ======================
// This must be last among GET routes
router.get(
    '/:id',
    protect,
    restrictTo('admin', 'teacher'),
    studentController.getStudentById
);

module.exports = router;