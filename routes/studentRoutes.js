const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController'); // Path to your controller
const upload = require('../config/multer'); // Path to my working multer config

//  Load the role restriction security guard
const { restrictTo } = require('../middleware/auth');

// --- PUBLIC ROUTES ---

// Public test route (no protection needed)
router.get('/test', (req, res) => {
    res.send('Student route is working!');
});


// --- PROTECTED ROUTES ---

//  Protected Registration: Only admins can register new students
//router.post('/register', restrictTo('admin'), upload.single('image'), studentController.registerStudent);
router.post('/register', studentController.registerStudent);

//  Protected Dashboard List: Both admins and teachers can view all students
router.get('/', restrictTo('admin', 'teacher'), studentController.getAllStudents);

//  Protected Individual Profile: Both admins and teachers can look up a student by ID
router.get('/:id', restrictTo('admin', 'teacher'), studentController.getStudentById);

// Protected Update: Only admins can edit student details/images
router.put('/:id', restrictTo('admin'), upload.single('image'), studentController.updateStudent);

//  Protected Delete: Only admins can remove a student from the system
router.delete('/:id', restrictTo('admin'), studentController.deleteStudent);

//promote student to next class
router.post('/promote', studentController.promoteStudent);

//bulk promote students to next class
router.post('/bulk-promote', studentController.bulkPromoteStudents);

//students login route
router.post('/login', studentController.loginStudent);

//
router.get('/profile/me', studentController.getMyProfile);
router.get('/profile/:id', studentController.getMyProfile);

module.exports = router;