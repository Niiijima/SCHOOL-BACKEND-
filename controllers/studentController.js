const Student = require('../models/Student');
const User = require('../models/User');
const TermStatus = require('../models/TermStatus');
const Grade = require('../models/Grade');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ====================== STUDENT LOGIN ======================
exports.loginStudent = async (req, res) => {
    try {
        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({ message: "Name and password are required" });
        }

        // Find student by name (case-insensitive)
        const student = await Student.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') } 
        });

        if (!student) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Find the linked user account
        const user = await User.findById(student.user).select('+password');
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate token
        const token = jwt.sign(
            { 
                id: user._id, 
                role: user.role,
                studentProfile: student._id 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            student: {
                id: student._id,
                name: student.name,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

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

// ====================== PROMOTE STUDENT ======================
exports.promoteStudent = async (req, res) => {
    try {
        const { admissionNumber, newClass, academicYear } = req.body;

        if (!admissionNumber || !newClass || !academicYear) {
            return res.status(400).json({ 
                message: "admissionNumber, newClass and academicYear are required" 
            });
        }

        // 1. Check if Third Term has been published/locked
        const termStatus = await TermStatus.findOne({
            academicYear,
            currentTerm: "Third Term"
        });

        if (!termStatus || !termStatus.isLocked) {
            return res.status(400).json({ 
                message: "Cannot promote student. Third Term results have not been published yet." 
            });
        }

        // 2. Find the student
        const student = await Student.findOne({ admissionNumber });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // 3. Promote
        const oldClass = student.currentClass;
        student.currentClass = newClass;
        await student.save();

        res.status(200).json({
            message: "Student promoted successfully",
            student: {
                id: student._id,
                name: student.name,
                admissionNumber: student.admissionNumber,
                oldClass,
                newClass: student.currentClass
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ====================== BULK PROMOTE STUDENTS ======================
exports.bulkPromoteStudents = async (req, res) => {
    try {
        const { academicYear, fromClass, toClass } = req.body;

        if (!academicYear || !fromClass || !toClass) {
            return res.status(400).json({ 
                message: "academicYear, fromClass and toClass are required" 
            });
        }

        // Check if Third Term has been published
        const termStatus = await TermStatus.findOne({
            academicYear,
            currentTerm: "Third Term"
        });

        if (!termStatus || !termStatus.isLocked) {
            return res.status(400).json({ 
                message: "Cannot promote students. Third Term results have not been published yet." 
            });
        }

        // Find all students in the class
        const students = await Student.find({ currentClass: fromClass });

        if (students.length === 0) {
            return res.status(404).json({ message: "No students found in this class" });
        }

        // Promote them
        const result = await Student.updateMany(
            { currentClass: fromClass },
            { $set: { currentClass: toClass } }
        );

        res.status(200).json({
            message: "Students promoted successfully",
            fromClass,
            toClass,
            totalPromoted: result.modifiedCount
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// ====================== GET STUDENT PROFILE ======================
exports.getMyProfile = async (req, res) => {
    try {
        const studentId = req.user?.studentProfile || req.params.id;

        const student = await Student.findById(studentId)
            .populate('user', 'email role');

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const academicYear = req.query.academicYear || "2025/2026";
        const grades = await Grade.find({ student: studentId, academicYear });

        const termStatus = {
            "First Term": grades.some(g => g.term === "First Term") ? "Available" : "Yet to be uploaded",
            "Second Term": grades.some(g => g.term === "Second Term") ? "Available" : "Yet to be uploaded",
            "Third Term": grades.some(g => g.term === "Third Term") ? "Available" : "Yet to be uploaded"
        };

        res.status(200).json({
            profile: {
                id: student._id,
                name: student.name,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                gender: student.gender,
                dateOfBirth: student.dateOfBirth,
                address: student.address || "",
                phone: student.phone || "",
                guardianName: student.guardianName,
                guardianPhone: student.guardianPhone,
                profileImage: student.profileImage || "",
                email: student.user?.email,
                status: student.status
            },
            academicYear,
            termStatus,
            availableActions: {
                viewFirstTerm: termStatus["First Term"] === "Available",
                viewSecondTerm: termStatus["Second Term"] === "Available",
                viewAnnualReport: termStatus["Third Term"] === "Available",
                viewAttendance: false,
                viewPerformanceGraph: true
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};