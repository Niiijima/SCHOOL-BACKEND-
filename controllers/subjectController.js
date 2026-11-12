
const Subject = require('../models/Subject');
const Student = require('../models/Student');

const ALLOWED_CLASSES = [
    'JSS1',
    'JSS2',
    'JSS3',
    'SS1',
    'SS2',
    'SS3'
];

const ALLOWED_DEPARTMENTS = [
    'Science',
    'Arts',
    'Commercial'
];

// Only SS2 and SS3 require departments.
const requiresDepartment = (className) => {
    return ['SS2', 'SS3'].includes(
        String(className || '').trim().toUpperCase()
    );
};

// Normalize department names.
const normalizeDepartment = (department) => {
    if (!department) return null;

    const value = String(department).trim();

    if (value.toLowerCase() === 'art') return 'Arts';

    const match = ALLOWED_DEPARTMENTS.find(
        (item) => item.toLowerCase() === value.toLowerCase()
    );

    return match || value;
};

// Convert class name into its section.
const getSection = (className) => {
    const normalizedClass = String(className || '')
        .trim()
        .toUpperCase();

    if (normalizedClass.startsWith('JSS')) return 'JSS';
    if (normalizedClass.startsWith('SS')) return 'SSS';

    return null;
};

// Validate and normalize class assignments.
const validateAssignments = (assignments) => {
    if (!Array.isArray(assignments) || assignments.length === 0) {
        throw new Error('At least one class assignment is required.');
    }

    const seen = new Set();

    return assignments.map((assignment) => {
        const className = String(assignment.className || '')
            .trim()
            .toUpperCase();

        const department = normalizeDepartment(assignment.department);

        if (!ALLOWED_CLASSES.includes(className)) {
            throw new Error(`Invalid class: ${className}`);
        }

        // SS2 and SS3 require a valid department.
        if (requiresDepartment(className)) {
            if (!ALLOWED_DEPARTMENTS.includes(department)) {
                throw new Error(
                    `${className} requires a valid department: Science, Arts, or Commercial.`
                );
            }
        } else {
            // JSS1-JSS3 and SS1 must not have departments.
            if (department) {
                throw new Error(
                    `${className} should not have a department.`
                );
            }
        }

        const key = `${className}-${department || 'GENERAL'}`;

        if (seen.has(key)) {
            throw new Error(`Duplicate class assignment: ${key}`);
        }

        seen.add(key);

        return {
            className,
            department: requiresDepartment(className)
                ? department
                : null
        };
    });
};

// Support the old frontend payload while accepting the new structure.
const getAssignmentsFromBody = (body) => {
    if (Array.isArray(body.classAssignments)) {
        return validateAssignments(body.classAssignments);
    }

    if (body.className) {
        return validateAssignments([
            {
                className: body.className,
                department: body.department || null
            }
        ]);
    }

    throw new Error('Class assignments are required.');
};

// Check whether a subject is assigned to a student's class and department.
const isSubjectAssignedToStudent = (subject, student) => {
    if (!Array.isArray(subject.classAssignments)) {
        return false;
    }

    const studentClass = String(student.currentClass || '')
        .trim()
        .toUpperCase();

    const studentDepartment = normalizeDepartment(student.department);

    if (!studentClass) return false;

    return subject.classAssignments.some((assignment) => {
        const assignedClass = String(assignment.className || '')
            .trim()
            .toUpperCase();

        if (assignedClass !== studentClass) {
            return false;
        }

        // JSS1-JSS3 and SS1 do not require departments.
        if (!requiresDepartment(studentClass)) {
            return true;
        }

        // SS2 and SS3 must match the student's department.
        return normalizeDepartment(assignment.department) === studentDepartment;
    });
};

// CREATE SUBJECT
exports.createSubject = async (req, res) => {
    try {
        const subjectName = String(
            req.body.subjectName || req.body.name || ''
        ).trim();

        const subjectCode = String(
            req.body.subjectCode || req.body.code || ''
        ).trim().toUpperCase();

        if (!subjectName || !subjectCode) {
            return res.status(400).json({
                success: false,
                message: 'Subject name and subject code are required.'
            });
        }

        const classAssignments = getAssignmentsFromBody(req.body);

        const existingSubject = await Subject.findOne({ subjectCode });

        if (existingSubject) {
            return res.status(409).json({
                success: false,
                message: 'A subject with this code already exists.'
            });
        }

        const section =
            req.body.section ||
            getSection(classAssignments[0].className);

        if (!['JSS', 'SSS'].includes(section)) {
            return res.status(400).json({
                success: false,
                message: 'A valid section (JSS or SSS) is required.'
            });
        }

        const subject = await Subject.create({
            subjectName,
            subjectCode,
            section,
            classAssignments
        });

        return res.status(201).json({
            success: true,
            message: 'Subject created successfully.',
            subject
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A subject with this code already exists.'
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// GET ALL SUBJECTS
exports.getAllSubjects = async (req, res) => {
    try {
        const subjects = await Subject.find()
            .populate('teacher', 'name email')
            .populate('enrolledStudents', 'name email phone admissionNumber');

        return res.status(200).json({
            success: true,
            count: subjects.length,
            subjects
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve subjects.',
            error: error.message
        });
    }
};

// UPDATE SUBJECT CLASS AND DEPARTMENT ASSIGNMENTS
exports.updateSubjectAssignments = async (req, res) => {
    try {
        const { subjectId } = req.params;

        const classAssignments = getAssignmentsFromBody(req.body);

        const subject = await Subject.findById(subjectId);

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found.'
            });
        }

        subject.classAssignments = classAssignments;

        // Keep the legacy section field populated.
        subject.section =
            getSection(classAssignments[0].className) ||
            subject.section;

        await subject.save();

        return res.status(200).json({
            success: true,
            message: 'Subject assignments updated successfully.',
            subject
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// ENROLL A STUDENT IN A SUBJECT
exports.enrollStudent = async (req, res) => {
    try {
        const {
            subjectId,
            subjectCode,
            studentId,
            admissionNumber
        } = req.body;

        let subject;

        if (subjectId) {
            subject = await Subject.findById(subjectId);
        } else if (subjectCode) {
            subject = await Subject.findOne({
                subjectCode: String(subjectCode).trim().toUpperCase()
            });
        }

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found.'
            });
        }

        let student;

        if (studentId) {
            student = await Student.findById(studentId);
        } else if (admissionNumber) {
            student = await Student.findOne({ admissionNumber });
        }

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        // Prevent enrollment in subjects not assigned to the student's class.
        if (!isSubjectAssignedToStudent(subject, student)) {
            return res.status(403).json({
                success: false,
                message: `${subject.subjectName} is not assigned to ${student.currentClass}${requiresDepartment(student.currentClass) && student.department ? ` (${student.department})` : ''}.`
            });
        }

        const alreadyEnrolled = subject.enrolledStudents.some(
            (id) => id.toString() === student._id.toString()
        );

        if (!alreadyEnrolled) {
            subject.enrolledStudents.push(student._id);
            await subject.save();
        }

        return res.status(200).json({
            success: true,
            message: alreadyEnrolled
                ? 'Student is already enrolled in this subject.'
                : 'Student enrolled successfully.',
            subject
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to enroll student.',
            error: error.message
        });
    }
};

// BULK CREATE SUBJECTS
// Each subject is created once, with all its assignments.
exports.createSubjectBulk = async (req, res) => {
    try {
        const subjects = req.body.subjects;

        if (!Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a non-empty subjects array.'
            });
        }

        const preparedSubjects = subjects.map((item) => {
            const subjectName = String(
                item.subjectName || item.name || ''
            ).trim();

            const subjectCode = String(
                item.subjectCode || item.code || ''
            ).trim().toUpperCase();

            if (!subjectName || !subjectCode) {
                throw new Error(
                    'Every subject must have a name and subject code.'
                );
            }

            const classAssignments = getAssignmentsFromBody(item);

            const section =
                item.section ||
                getSection(classAssignments[0].className);

            if (!['JSS', 'SSS'].includes(section)) {
                throw new Error(
                    `Invalid section for subject: ${subjectName}.`
                );
            }

            return {
                subjectName,
                subjectCode,
                section,
                classAssignments
            };
        });

        const codes = preparedSubjects.map(
            (item) => item.subjectCode
        );

        if (new Set(codes).size !== codes.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate subject codes found in the request.'
            });
        }

        const existingSubjects = await Subject.find({
            subjectCode: { $in: codes }
        });

        if (existingSubjects.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Some subject codes already exist.',
                existingCodes: existingSubjects.map(
                    (subject) => subject.subjectCode
                )
            });
        }

        const createdSubjects = await Subject.insertMany(
            preparedSubjects
        );

        return res.status(201).json({
            success: true,
            message: 'Subjects created successfully.',
            count: createdSubjects.length,
            subjects: createdSubjects
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// GET STUDENTS ELIGIBLE FOR A SUBJECT
exports.getSubjectEligibleStudents = async (req, res) => {
    try {
        const { subjectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subject ID.'
            });
        }

        const subject = await Subject.findById(subjectId);

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found.'
            });
        }

        const classFilters = subject.classAssignments.map(
            (assignment) => {
                const filter = {
                    currentClass: assignment.className,
                    status: 'active'
                };

                if (requiresDepartment(assignment.className)) {
                    filter.department = assignment.department;
                }

                return filter;
            }
        );

        const students = await Student.find({
            $or: classFilters
        }).select(
            'firstName surname admissionNumber currentClass department'
        ).sort({
            surname: 1,
            firstName: 1
        });

        const excludedIds = new Set(
            (subject.excludedStudents || []).map(
                (id) => id.toString()
            )
        );

        const result = students.map((student) => ({
            _id: student._id,
            firstName: student.firstName,
            surname: student.surname,
            name: student.name,
            admissionNumber: student.admissionNumber,
            currentClass: student.currentClass,
            department: student.department || null,
            excluded: excludedIds.has(student._id.toString())
        }));

        return res.status(200).json({
            success: true,
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            count: result.length,
            students: result
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve eligible students.',
            error: error.message
        });
    }
};


// EXCLUDE OR RESTORE A STUDENT IN A SUBJECT
exports.updateStudentSubjectExclusion = async (req, res) => {
    try {
        const { subjectId, studentId } = req.params;
        const { excluded } = req.body;

        if (
            !mongoose.Types.ObjectId.isValid(subjectId) ||
            !mongoose.Types.ObjectId.isValid(studentId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subject or student ID.'
            });
        }

        if (typeof excluded !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'The excluded field must be true or false.'
            });
        }

        const subject = await Subject.findById(subjectId);

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found.'
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        if (!isSubjectAssignedToStudent(subject, student)) {
            // An already-excluded student should still be restorable.
            const alreadyExcluded = (
                subject.excludedStudents || []
            ).some((id) => id.toString() === studentId);

            if (!alreadyExcluded) {
                return res.status(400).json({
                    success: false,
                    message: 'This subject is not assigned to the student’s class and department.'
                });
            }
        }

        const alreadyExcluded = (
            subject.excludedStudents || []
        ).some((id) => id.toString() === studentId);

        if (excluded && !alreadyExcluded) {
            subject.excludedStudents.push(student._id);
        }

        if (!excluded && alreadyExcluded) {
            subject.excludedStudents = subject.excludedStudents.filter(
                (id) => id.toString() !== studentId
            );
        }

        await subject.save();

        return res.status(200).json({
            success: true,
            message: excluded
                ? `${student.firstName} ${student.surname} has been excluded from ${subject.subjectName}.`
                : `${student.firstName} ${student.surname} has been restored to ${subject.subjectName}.`,
            excluded
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update student subject assignment.',
            error: error.message
        });
    }
};