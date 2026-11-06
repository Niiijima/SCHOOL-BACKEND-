const Student = require('../models/Student');
const User = require('../models/User');
const TermStatus = require('../models/TermStatus');
const Grade = require('../models/Grade');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { validateClassAndDepartment, formatClassDisplay } = require('../utils/allowedClasses');

// ====================== STUDENT LOGIN ======================
exports.loginStudent = async (req, res) => {
    try {
        const { admissionNumber, password } = req.body;

        if (!admissionNumber || !password) {
            return res.status(400).json({ 
                message: "Admission number and password are required" 
            });
        }

        const student = await Student.findOne({ admissionNumber });
        if (!student) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = await User.findById(student.user).select('+password');
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (user.isActive === false) {
            return res.status(401).json({ message: "This account has been deactivated" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

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
            admissionNumber,
            email,
            password,
            currentClass,
            department,
            // ... other fields
        } = req.body;

        // Validate class + department
        const classCheck = validateClassAndDepartment(currentClass, department || null);
        if (!classCheck.valid) {
            return res.status(400).json({ message: classCheck.message });
        }

        // ... rest of your existing register logic
        // (check existing admissionNumber / email, hash password, create student, etc.)

        const student = await Student.create({
            name,
            admissionNumber,
            email,
            password: hashedPassword,   // or however you hash
            currentClass,
            department: department || null,
            // ... other fields
            image: req.file ? req.file.path : undefined
        });

        res.status(201).json({
            message: 'Student registered successfully',
            student: {
                id: student._id,
                name: student.name,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                department: student.department,
                displayClass: formatClassDisplay(student.currentClass, student.department)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


// ====================== UPDATE STUDENT ======================
exports.updateStudent = async (req, res) => {
    try {
        const { currentClass, department } = req.body;

        // Only validate if class or department is being changed
        if (currentClass !== undefined || department !== undefined) {
            const student = await Student.findById(req.params.id);
            if (!student) {
                return res.status(404).json({ message: 'Student not found' });
            }

            const newClass = currentClass !== undefined ? currentClass : student.currentClass;
            const newDept  = department !== undefined ? department : student.department;

            const classCheck = validateClassAndDepartment(newClass, newDept || null);
            if (!classCheck.valid) {
                return res.status(400).json({ message: classCheck.message });
            }
        }

        // ... rest of your update logic
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
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

        const { 
            name, 
            currentClass, 
            gender, 
            guardianName, 
            guardianPhone, 
            status,
            address,
            phone
        } = req.body;

        if (name) student.name = name;
        if (currentClass) student.currentClass = currentClass;
        if (gender) student.gender = gender;
        if (guardianName) student.guardianName = guardianName;
        if (guardianPhone) student.guardianPhone = guardianPhone;
        if (status) student.status = status;
        if (address) student.address = address;
        if (phone) student.phone = phone;

        // Save uploaded image if present
        if (req.file) {
            student.profileImage = req.file.path;
        }

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

        // 1. Delete Cloudinary image first
        if (student.profileImage) {
            try {
                const urlParts = student.profileImage.split('/');
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const publicId = `school_backend_students/${fileNameWithExtension.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (imgErr) {
                console.error("Cloudinary delete failed:", imgErr.message);
            }
        }

        const userId = student.user;

        // 2. Delete student
        await Student.findByIdAndDelete(student._id);

        // 3. Delete linked user
        if (userId) {
            await User.findByIdAndDelete(userId);
        }

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

        const termStatus = await TermStatus.findOne({
            academicYear,
            currentTerm: "Third Term"
        });

        if (!termStatus || !termStatus.isLocked) {
            return res.status(400).json({ 
                message: "Cannot promote student. Third Term results have not been published yet." 
            });
        }

        const student = await Student.findOne({ admissionNumber });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        if (student.status !== "active") {
            return res.status(400).json({ 
                message: `Cannot promote student with status: ${student.status}` 
            });
        }

        if (student.currentClass === newClass) {
            return res.status(400).json({ 
                message: "Student is already in the target class" 
            });
        }

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

        if (fromClass === toClass) {
            return res.status(400).json({ 
                message: "fromClass and toClass cannot be the same" 
            });
        }

        const termStatus = await TermStatus.findOne({
            academicYear,
            currentTerm: "Third Term"
        });

        if (!termStatus || !termStatus.isLocked) {
            return res.status(400).json({ 
                message: "Cannot promote students. Third Term results have not been published yet." 
            });
        }

        const students = await Student.find({
            currentClass: fromClass,
            status: "active"
        });

        if (students.length === 0) {
            return res.status(404).json({ 
                message: "No active students found in this class" 
            });
        }

        const result = await Student.updateMany(
            { currentClass: fromClass, status: "active" },
            { $set: { currentClass: toClass } }
        );

        res.status(200).json({
            message: "Bulk promotion completed",
            fromClass,
            toClass,
            matched: students.length,
            totalPromoted: result.modifiedCount,
            notModified: students.length - result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// ====================== GET STUDENT PROFILE ======================
exports.getMyProfile = async (req, res) => {
    try {
        let studentId;

        if (req.user.role === 'student') {
            studentId = req.user.studentProfile;

            if (!studentId) {
                return res.status(404).json({ message: "Student profile not found for this account" });
            }

            if (req.params.id && req.params.id !== studentId.toString()) {
                return res.status(403).json({ message: "You are not allowed to view another student's profile" });
            }
        } 
        else if (['admin', 'teacher'].includes(req.user.role)) {
            studentId = req.params.id;

            if (!studentId) {
                return res.status(400).json({ message: "Student ID is required" });
            }
        } 
        else {
            return res.status(403).json({ message: "Access denied" });
        }

        const student = await Student.findById(studentId)
            .populate('user', 'email role');

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const { getCurrentAcademicYear } = require('../utils/academicYear');
        const academicYear = req.query.academicYear || await getCurrentAcademicYear();

        const grades = await Grade.find({ student: studentId, academicYear });

        const termNames = ["First Term", "Second Term", "Third Term"];
        const termStatus = {};

        for (const termName of termNames) {
            const published = await TermStatus.findOne({
                academicYear,
                currentTerm: termName,
                isLocked: true
            });

            const hasGrades = grades.some(g => g.term === termName);

            if (published && hasGrades) {
                termStatus[termName] = "Available";
            } else if (hasGrades && !published) {
                termStatus[termName] = "Not published";
            } else {
                termStatus[termName] = "Yet to be uploaded";
            }
        }

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