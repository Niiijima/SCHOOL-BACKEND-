const Student = require('../models/Student');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

// ====================== REGISTER STUDENT ======================
exports.registerStudent = async (req, res) => {
    try {
        const { 
            name, 
            email, 
            password, 
            admissionNumber, 
            currentClass, 
            gender, 
            dateOfBirth, 
            guardianName, 
            guardianPhone 
        } = req.body;

        if (!name || !email || !password || !admissionNumber || !currentClass || !gender) {
            return res.status(400).json({ 
                message: "Please provide name, email, password, admissionNumber, currentClass and gender" 
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "A user with this email already exists" });
        }

        const existingStudent = await Student.findOne({ admissionNumber });
        if (existingStudent) {
            return res.status(400).json({ message: "Admission number already exists" });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create User
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'student'
        });

        // Create Student linked to User
        const newStudent = await Student.create({
            user: newUser._id,
            name,
            admissionNumber,
            currentClass,
            gender,
            dateOfBirth,
            guardianName,
            guardianPhone
        });

        res.status(201).json({
            message: "Student registered successfully!",
            student: {
                id: newStudent._id,
                name: newStudent.name,
                admissionNumber: newStudent.admissionNumber,
                currentClass: newStudent.currentClass,
                gender: newStudent.gender,
                userId: newUser._id
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ====================== GET ALL STUDENTS ======================
exports.getAllStudents = async (req, res) => {
    try {
        const students = await Student.find().populate('user', 'email role');
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ====================== GET STUDENT BY ID ======================
exports.getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('user', 'email role');
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        res.status(200).json(student);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ====================== UPDATE STUDENT ======================
exports.updateStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const { name, currentClass, gender, guardianName, guardianPhone, status } = req.body;

        if (name) student.name = name;
        if (currentClass) student.currentClass = currentClass;
        if (gender) student.gender = gender;
        if (guardianName) student.guardianName = guardianName;
        if (guardianPhone) student.guardianPhone = guardianPhone;
        if (status) student.status = status;

        await student.save();

        res.status(200).json({
            message: "Student profile updated successfully!",
            student
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ====================== DELETE STUDENT ======================
exports.deleteStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Delete the linked User account as well
        if (student.user) {
            await User.findByIdAndDelete(student.user);
        }

        // Delete Cloudinary image if exists
        if (student.profileImage) {
            const urlParts = student.profileImage.split('/');
            const fileNameWithExtension = urlParts[urlParts.length - 1];
            const publicId = `school_backend_students/${fileNameWithExtension.split('.')[0]}`;
            await cloudinary.uploader.destroy(publicId);
        }

        // Delete the student profile
        await Student.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Student profile and linked user deleted successfully!"
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};