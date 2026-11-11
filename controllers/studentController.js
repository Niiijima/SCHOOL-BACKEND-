

const Student = require('../models/Student');
const User = require('../models/User');
const Counter = require('../models/Counter');
const TermStatus = require('../models/TermStatus');
const Grade = require('../models/Grade');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

const {
    validateClassAndDepartment,
    formatClassDisplay,
    requiresDepartment
} = require('../utils/allowedClasses');

const normalizeName = (value) => {
    return String(value || '').trim().replace(/\s+/g, ' ');
};

const normalizeEmail = (value) => {
    return String(value || '').trim().toLowerCase();
};

const isDuplicateError = (error) => error.code === 11000;


// ====================== ADMISSION NUMBER GENERATOR ======================

const generateAdmissionNumber = async () => {
    const counterId = 'studentAdmissionNumber';

    // Initialise the counter using existing admission numbers
    // if this is the first time the generator is being used.
    const counterExists = await Counter.exists({
        _id: counterId
    });

    if (!counterExists) {
        const existingNumbers = await Student.aggregate([
            {
                $match: {
                    admissionNumber: {
                        $regex: /^SCH\/\d{4}\/\d+$/
                    }
                }
            },
            {
                $project: {
                    sequence: {
                        $convert: {
                            input: {
                                $arrayElemAt: [
                                    { $split: ['$admissionNumber', '/'] },
                                    2
                                ]
                            },
                            to: 'long',
                            onError: 0,
                            onNull: 0
                        }
                    }
                }
            },
            {
                $sort: {
                    sequence: -1
                }
            },
            {
                $limit: 1
            }
        ]);

        const startingSequence =
            existingNumbers.length > 0
                ? existingNumbers[0].sequence
                : 0;

        try {
            await Counter.create({
                _id: counterId,
                seq: startingSequence
            });
        } catch (error) {
            // Another registration may have created the counter first.
            if (error.code !== 11000) {
                throw error;
            }
        }
    }

    // Atomic increment prevents duplicate numbers during simultaneous registrations.
    const counter = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    const admissionYear = new Date().getFullYear();

    return `SCH/${admissionYear}/${String(counter.seq).padStart(4, '0')}`;
};


// ====================== STUDENT LOGIN ======================

exports.loginStudent = async (req, res) => {
    try {
        const { admissionNumber, password } = req.body;

        if (!admissionNumber || !password) {
            return res.status(400).json({
                message: 'Admission number and password are required'
            });
        }

        const student = await Student.findOne({
            admissionNumber: String(admissionNumber).trim()
        });

        if (!student) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const user = await User.findById(student.user).select('+password');

        if (!user || user.isActive === false) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: 'Authentication configuration error'
            });
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

        return res.status(200).json({
            message: 'Login successful',
            token,
            student: {
                id: student._id,
                firstName: student.firstName,
                surname: student.surname,
                name: student.name,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                department: student.department || null,
                displayClass: student.displayClass
            }
        });

    } catch (error) {
        console.error('Student login error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ====================== REGISTER STUDENT ======================

exports.registerStudent = async (req, res) => {
    let createdUser = null;

    try {
        const {
            firstName,
            surname,
            email,
            currentClass,
            department,
            gender,
            dateOfBirth,
            address,
            phone,
            guardianName,
            guardianPhone
        } = req.body;

        const cleanFirstName = normalizeName(firstName);
        const cleanSurname = normalizeName(surname);
        const cleanEmail = normalizeEmail(email);

        if (
            !cleanFirstName ||
            !cleanSurname ||
            !cleanEmail ||
            !gender ||
            !currentClass
        ) {
            return res.status(400).json({
                message: 'First name, surname, email, gender and class are required'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                message: 'Please provide a valid email address'
            });
        }

        if (!['Male', 'Female'].includes(gender)) {
            return res.status(400).json({
                message: 'Gender must be Male or Female'
            });
        }

        const classCheck = validateClassAndDepartment(
            currentClass,
            department || null
        );

        if (!classCheck.valid) {
            return res.status(400).json({
                message: classCheck.message
            });
        }

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'This email address is already registered'
            });
        }

        // Generate the admission number automatically.
        const cleanAdmissionNumber = await generateAdmissionNumber();

        // The student's surname remains their initial password.
        // User.js automatically hashes it before saving.
        const initialPassword = cleanSurname.toLowerCase();

        // Create the user account first.
        createdUser = await User.create({
            name: `${cleanFirstName} ${cleanSurname}`,
            email: cleanEmail,
            password: initialPassword,
            role: 'student',
            isActive: true
        });

        // Create the student profile and link it to the user.
        const student = await Student.create({
            user: createdUser._id,
            firstName: cleanFirstName,
            surname: cleanSurname,
            admissionNumber: cleanAdmissionNumber,
            currentClass: classCheck.class,
            department: classCheck.department || undefined,
            gender,
            dateOfBirth: dateOfBirth || undefined,
            address,
            phone,
            guardianName,
            guardianPhone,
            profileImage: req.file ? req.file.path : ''
        });

        // Link the student profile back to the user.
        createdUser.studentProfile = student._id;
        await createdUser.save();

        return res.status(201).json({
            message: 'Student registered successfully',
            student: {
                id: student._id,
                firstName: student.firstName,
                surname: student.surname,
                name: student.name,
                admissionNumber: student.admissionNumber,
                email: createdUser.email,
                currentClass: student.currentClass,
                department: student.department || null,
                displayClass: student.displayClass,
                gender: student.gender,
                profileImage: student.profileImage
            },
            initialPassword
        });

    } catch (error) {
        console.error('Student registration error:', error);

        // Prevent orphaned user accounts if student creation fails.
        if (createdUser) {
            try {
                await User.findByIdAndDelete(createdUser._id);
            } catch (cleanupError) {
                console.error(
                    'Failed to clean up user account:',
                    cleanupError.message
                );
            }
        }

        if (isDuplicateError(error)) {
            return res.status(409).json({
                message: 'Admission number or email already exists'
            });
        }

        return res.status(500).json({
            message: 'Student registration failed',
            error: error.message
        });
    }
};


// ====================== GET ALL STUDENTS ======================

exports.getAllStudents = async (req, res) => {
    try {
        const students = await Student.find()
            .populate('user', 'name email role isActive')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: students.length,
            students
        });

    } catch (error) {
        console.error('Get All Students Error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve students.',
            error: error.message
        });
    }
};


// ====================== GET STUDENT BY ID ======================

exports.getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('user', 'email role isActive');

        if (!student) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        return res.status(200).json(student);

    } catch (error) {
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ====================== UPDATE STUDENT ======================

exports.updateStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        const {
            firstName,
            surname,
            currentClass,
            department,
            gender,
            dateOfBirth,
            guardianName,
            guardianPhone,
            status,
            address,
            phone
        } = req.body;

        // Validate class and department if either is being changed.
        if (currentClass !== undefined || department !== undefined) {
            const newClass =
                currentClass !== undefined
                    ? currentClass
                    : student.currentClass;

            const newDepartment =
                department !== undefined
                    ? department
                    : student.department;

            const classCheck = validateClassAndDepartment(
                newClass,
                newDepartment || null
            );

            if (!classCheck.valid) {
                return res.status(400).json({
                    message: classCheck.message
                });
            }

            student.currentClass = classCheck.class;
            student.department = classCheck.department || undefined;
        }

        if (firstName !== undefined) {
            const cleanFirstName = normalizeName(firstName);

            if (!cleanFirstName) {
                return res.status(400).json({
                    message: 'First name cannot be empty'
                });
            }

            student.firstName = cleanFirstName;
        }

        if (surname !== undefined) {
            const cleanSurname = normalizeName(surname);

            if (!cleanSurname) {
                return res.status(400).json({
                    message: 'Surname cannot be empty'
                });
            }

            student.surname = cleanSurname;
        }

        if (gender !== undefined) {
            if (!['Male', 'Female'].includes(gender)) {
                return res.status(400).json({
                    message: 'Gender must be Male or Female'
                });
            }

            student.gender = gender;
        }

        if (dateOfBirth !== undefined) {
            student.dateOfBirth = dateOfBirth || undefined;
        }

        if (guardianName !== undefined) {
            student.guardianName = guardianName;
        }

        if (guardianPhone !== undefined) {
            student.guardianPhone = guardianPhone;
        }

        if (status !== undefined) {
            if (!['active', 'graduated', 'withdrawn'].includes(status)) {
                return res.status(400).json({
                    message: 'Invalid student status'
                });
            }

            student.status = status;
        }

        if (address !== undefined) {
            student.address = address;
        }

        if (phone !== undefined) {
            student.phone = phone;
        }

        if (req.file) {
            student.profileImage = req.file.path;
        }

        await student.save();

        // Keep the linked User account name synchronized.
        const user = await User.findById(student.user);

        if (user) {
            user.name = `${student.firstName} ${student.surname}`;
            await user.save();
        }

        return res.status(200).json({
            message: 'Student profile updated successfully',
            student
        });

    } catch (error) {
        console.error('Update student error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ====================== DELETE STUDENT ======================

exports.deleteStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        // Delete the Cloudinary image if one exists.
        if (student.profileImage) {
            try {
                const urlParts = student.profileImage.split('/');
                const fileNameWithExtension = urlParts[urlParts.length - 1];
                const publicId =
                    `school_backend_students/${fileNameWithExtension.split('.')[0]}`;

                await cloudinary.uploader.destroy(publicId);

            } catch (imgError) {
                console.error(
                    'Cloudinary delete failed:',
                    imgError.message
                );
            }
        }

        const userId = student.user;

        await Student.findByIdAndDelete(student._id);

        if (userId) {
            await User.findByIdAndDelete(userId);
        }

        return res.status(200).json({
            message: 'Student profile and linked user deleted successfully'
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ====================== PROMOTE STUDENT ======================

exports.promoteStudent = async (req, res) => {
    try {
        const {
            admissionNumber,
            newClass,
            department,
            academicYear
        } = req.body;

        if (!admissionNumber || !newClass || !academicYear) {
            return res.status(400).json({
                message: 'admissionNumber, newClass and academicYear are required'
            });
        }

        const classCheck = validateClassAndDepartment(
            newClass,
            department || null
        );

        if (!classCheck.valid) {
            return res.status(400).json({
                message: classCheck.message
            });
        }

        const termStatus = await TermStatus.findOne({
            academicYear,
            currentTerm: 'Third Term'
        });

        if (!termStatus || !termStatus.isLocked) {
            return res.status(400).json({
                message: 'Cannot promote student. Third Term results have not been published yet.'
            });
        }

        const student = await Student.findOne({
            admissionNumber: String(admissionNumber).trim()
        });

        if (!student) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        if (student.status !== 'active') {
            return res.status(400).json({
                message: `Cannot promote student with status: ${student.status}`
            });
        }

        if (
            student.currentClass === classCheck.class &&
            (student.department || null) === (classCheck.department || null)
        ) {
            return res.status(400).json({
                message: 'Student is already in the target class and department'
            });
        }

        const oldClass = student.currentClass;
        const oldDepartment = student.department || null;

        student.currentClass = classCheck.class;
        student.department = classCheck.department || undefined;

        await student.save();

        return res.status(200).json({
            message: 'Student promoted successfully',
            student: {
                id: student._id,
                firstName: student.firstName,
                surname: student.surname,
                name: student.name,
                admissionNumber: student.admissionNumber,
                oldClass,
                oldDepartment,
                newClass: student.currentClass,
                newDepartment: student.department || null,
                displayClass: student.displayClass
            }
        });

    } catch (error) {
        console.error('Promote student error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ====================== BULK PROMOTE STUDENTS ======================

exports.bulkPromoteStudents = async (req, res) => {
    try {
        const {
            academicYear,
            fromClass,
            fromDepartment,
            toClass,
            toDepartment
        } = req.body;

        if (!academicYear || !fromClass || !toClass) {
            return res.status(400).json({
                message: 'academicYear, fromClass and toClass are required'
            });
        }

        const sourceCheck = validateClassAndDepartment(
            fromClass,
            fromDepartment || null
        );

        if (!sourceCheck.valid) {
            return res.status(400).json({
                message: `Source class: ${sourceCheck.message}`
            });
        }

        const targetCheck = validateClassAndDepartment(
            toClass,
            toDepartment || null
        );

        if (!targetCheck.valid) {
            return res.status(400).json({
                message: `Target class: ${targetCheck.message}`
            });
        }

        if (
            sourceCheck.class === targetCheck.class &&
            (sourceCheck.department || null) ===
                (targetCheck.department || null)
        ) {
            return res.status(400).json({
                message: 'Source and target class/department cannot be the same'
            });
        }

        const termStatus = await TermStatus.findOne({
            academicYear,
            currentTerm: 'Third Term'
        });

        if (!termStatus || !termStatus.isLocked) {
            return res.status(400).json({
                message: 'Cannot promote students. Third Term results have not been published yet.'
            });
        }

        const sourceFilter = {
            currentClass: sourceCheck.class,
            status: 'active'
        };

        if (requiresDepartment(sourceCheck.class)) {
            sourceFilter.department = sourceCheck.department;
        }

        const students = await Student.find(sourceFilter);

        if (students.length === 0) {
            return res.status(404).json({
                message: 'No active students found in the specified source class and department'
            });
        }

        const update = {
            $set: {
                currentClass: targetCheck.class
            }
        };

        if (requiresDepartment(targetCheck.class)) {
            update.$set.department = targetCheck.department;
        } else {
            update.$unset = { department: 1 };
        }

        const result = await Student.updateMany(
            sourceFilter,
            update,
            { runValidators: true }
        );

        return res.status(200).json({
            message: 'Bulk promotion completed',
            fromClass: sourceCheck.class,
            fromDepartment: sourceCheck.department || null,
            toClass: targetCheck.class,
            toDepartment: targetCheck.department || null,
            matched: result.matchedCount,
            totalPromoted: result.modifiedCount,
            notModified: result.matchedCount - result.modifiedCount
        });

    } catch (error) {
        console.error('Bulk promotion error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ====================== GET STUDENT PROFILE ======================

exports.getMyProfile = async (req, res) => {
    try {
        let studentId;

        if (req.user.role === 'student') {
            studentId = req.user.studentProfile;

            if (!studentId) {
                return res.status(404).json({
                    message: 'Student profile not found for this account'
                });
            }

            if (
                req.params.id &&
                req.params.id !== studentId.toString()
            ) {
                return res.status(403).json({
                    message: 'You are not allowed to view another student profile'
                });
            }

        } else if (['admin', 'teacher'].includes(req.user.role)) {
            studentId = req.params.id;

            if (!studentId) {
                return res.status(400).json({
                    message: 'Student ID is required'
                });
            }

        } else {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        const student = await Student.findById(studentId)
            .populate('user', 'email role');

        if (!student) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        const {
            getCurrentAcademicYear
        } = require('../utils/academicYear');

        const academicYear =
            req.query.academicYear ||
            await getCurrentAcademicYear();

        const grades = await Grade.find({
            student: studentId,
            academicYear
        });

        const termNames = [
            'First Term',
            'Second Term',
            'Third Term'
        ];

        const termStatus = {};

        for (const termName of termNames) {
            const published = await TermStatus.findOne({
                academicYear,
                currentTerm: termName,
                isLocked: true
            });

            const hasGrades = grades.some(
                grade => grade.term === termName
            );

            if (published && hasGrades) {
                termStatus[termName] = 'Available';
            } else if (hasGrades && !published) {
                termStatus[termName] = 'Not published';
            } else {
                termStatus[termName] = 'Yet to be uploaded';
            }
        }

        return res.status(200).json({
            profile: {
                id: student._id,
                firstName: student.firstName,
                surname: student.surname,
                name: student.name,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                department: student.department || null,
                displayClass: student.displayClass,
                gender: student.gender,
                dateOfBirth: student.dateOfBirth,
                address: student.address || '',
                phone: student.phone || '',
                guardianName: student.guardianName,
                guardianPhone: student.guardianPhone,
                profileImage: student.profileImage || '',
                email: student.user?.email,
                status: student.status
            },
            academicYear,
            termStatus,
            availableActions: {
                viewFirstTerm:
                    termStatus['First Term'] === 'Available',
                viewSecondTerm:
                    termStatus['Second Term'] === 'Available',
                viewAnnualReport:
                    termStatus['Third Term'] === 'Available',
                viewAttendance: false,
                viewPerformanceGraph: true
            }
        });

    } catch (error) {
        console.error('Get student profile error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
