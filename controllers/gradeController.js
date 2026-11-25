
const mongoose = require('mongoose');

const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const TermStatus = require('../models/TermStatus');
const Student = require('../models/Student');
const ResultLock = require('../models/ResultLock');

const {
    calculateGrade,
    getAutomaticYearTutorComment,
    getAutomaticAdminComment,
} = require('../utils/gradeCalculator');

const { getCurrentAcademicYear } = require('../utils/academicYear');

// ======================================================
// HELPERS
// ======================================================

const getWAECGrade = (avg) => {
    if (avg >= 75) return { annualGrade: 'A1', annualRemark: 'Excellent' };
    if (avg >= 70) return { annualGrade: 'B2', annualRemark: 'Very Good' };
    if (avg >= 65) return { annualGrade: 'B3', annualRemark: 'Good' };
    if (avg >= 60) return { annualGrade: 'C4', annualRemark: 'Credit' };
    if (avg >= 55) return { annualGrade: 'C5', annualRemark: 'Credit' };
    if (avg >= 50) return { annualGrade: 'C6', annualRemark: 'Credit' };
    if (avg >= 45) return { annualGrade: 'D7', annualRemark: 'Pass' };
    if (avg >= 40) return { annualGrade: 'E8', annualRemark: 'Fair' };
    return { annualGrade: 'F9', annualRemark: 'Fail' };
};

const normalizeDepartment = (department) => {
    if (!department) return null;

    const value = String(department).trim();

    if (value.toLowerCase() === 'art') return 'Arts';

    return value;
};

const requiresDepartment = (className) => {
    const normalizedClass = String(className || '').trim().toUpperCase();

    return ['SS2', 'SS3'].includes(normalizedClass);
};

const isStudentExcludedFromSubject = (subject, student) => {
    if (!subject || !student?._id) return false;

    const studentId = student._id.toString();

    return (subject.excludedStudents || []).some(
        (id) => id.toString() === studentId
    );
};

const isSubjectAssignedToStudent = (subject, student) => {
    if (!subject || !student || !Array.isArray(subject.classAssignments)) {
        return false;
    }

    if (isStudentExcludedFromSubject(subject, student)) {
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

        if (assignedClass !== studentClass) return false;

        if (!requiresDepartment(studentClass)) return true;

        return (
            normalizeDepartment(assignment.department) === studentDepartment
        );
    });
};

const getStudentSection = (student) => {
    const currentClass = String(student.currentClass || '')
        .trim()
        .toUpperCase();

    if (currentClass.startsWith('JSS')) return 'JSS';

    if (currentClass.startsWith('SS')) return 'SSS';

    return null;
};

const getClassSize = async (student) => {
    if (!student?.currentClass) return null;

    const query = {
        currentClass: student.currentClass,
        status: 'active',
    };

    if (requiresDepartment(student.currentClass) && student.department) {
        query.department = student.department;
    }

    return Student.countDocuments(query);
};

// Check whether a score is actually present.
// Zero is a valid submitted score.
const hasScore = (value) =>
    value !== undefined && value !== null && value !== '';

const validateScore = (value, maximum) => {
    if (!hasScore(value)) return null;

    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0 ||
        number > maximum
    ) {
        return false;
    }

    return number;
};

// Calculate a result only when all CA components and the exam exist.
const calculateCompletedResult = (studentSection, values) => {
    const caFields = ['test1', 'test2', 'notes', 'oral'];

    const caComplete = caFields.every((field) =>
        hasScore(values[field])
    );

    const examComplete = hasScore(values.exam);

    if (!caComplete || !examComplete) {
        return {
            caSubmitted: caComplete,
            examSubmitted: examComplete,
            totalScore: null,
            grade: null,
            remark: null,
        };
    }

    const result = calculateGrade(
        studentSection,
        Number(values.test1),
        Number(values.test2),
        Number(values.notes),
        Number(values.oral),
        Number(values.exam)
    );

    return {
        caSubmitted: true,
        examSubmitted: true,
        totalScore: result.totalScore,
        grade: result.grade,
        remark: result.remark,
    };
};

// ======================================================
// GET STUDENTS BY SUBJECT
// ======================================================

exports.getStudentsBySubject = async (req, res) => {
    try {
        const { subjectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({
                message: 'Invalid subject ID.',
            });
        }

        const subjectData = await Subject.findById(subjectId).populate(
            'enrolledStudents',
            'name firstName surname email admissionNumber currentClass department'
        );

        if (!subjectData) {
            return res.status(404).json({
                message: 'Subject not found.',
            });
        }

        const excludedIds = new Set(
            (subjectData.excludedStudents || []).map((id) =>
                id.toString()
            )
        );

        const availableStudents = (
            subjectData.enrolledStudents || []
        ).filter(
            (student) =>
                student &&
                !excludedIds.has(student._id.toString())
        );

        return res.status(200).json({
            subjectName: subjectData.subjectName,
            subjectCode: subjectData.subjectCode,
            section: subjectData.section,
            classAssignments: subjectData.classAssignments,
            students: availableStudents,
        });
    } catch (error) {
        console.error('Get Students By Subject Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};

// ======================================================
// SUBMIT INDIVIDUAL STUDENT SCORES — LEGACY ROUTE
// ======================================================

exports.submitStudentScores = async (req, res) => {
    try {
        let {
            student,
            subject,
            studentName,
            subjectName,
            admissionNumber,
            subjectCode,
            term,
            academicYear,
            test1,
            test2,
            test3,
            assignment,
            exam,
            noInClass,
        } = req.body;

        if (!academicYear) {
            academicYear = await getCurrentAcademicYear();
        }

        if (!student && admissionNumber) {
            const studentDoc = await Student.findOne({ admissionNumber });

            if (!studentDoc) {
                return res.status(404).json({
                    message: `Student not found: ${admissionNumber}`,
                });
            }

            student = studentDoc._id;
        }

        if (!student && studentName) {
            const studentDoc = await Student.findOne({
                $or: [
                    { name: { $regex: studentName, $options: 'i' } },
                    { firstName: { $regex: studentName, $options: 'i' } },
                    { surname: { $regex: studentName, $options: 'i' } },
                ],
            });

            if (!studentDoc) {
                return res.status(404).json({
                    message: `Student not found: ${studentName}`,
                });
            }

            student = studentDoc._id;
        }

        if (!subject && subjectCode) {
            const subjectDoc = await Subject.findOne({
                subjectCode: String(subjectCode).toUpperCase(),
            });

            if (!subjectDoc) {
                return res.status(404).json({
                    message: `Subject not found: ${subjectCode}`,
                });
            }

            subject = subjectDoc._id;
        }

        if (!subject && subjectName) {
            const subjectDoc = await Subject.findOne({
                subjectName: { $regex: subjectName, $options: 'i' },
            });

            if (!subjectDoc) {
                return res.status(404).json({
                    message: `Subject not found: ${subjectName}`,
                });
            }

            subject = subjectDoc._id;
        }

        if (!student || !subject) {
            return res.status(400).json({
                message: 'Please provide a student and subject.',
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(student) ||
            !mongoose.Types.ObjectId.isValid(subject)
        ) {
            return res.status(400).json({
                message: 'Invalid student or subject ID.',
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(term)) {
            return res.status(400).json({
                message: 'Invalid term supplied.',
            });
        }

        const studentDetails = await Student.findById(student);
        const subjectDetails = await Subject.findById(subject);

        if (!studentDetails) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        if (!subjectDetails) {
            return res.status(404).json({ message: 'Subject not found.' });
        }

        const studentSection = getStudentSection(studentDetails);

        if (!studentSection) {
            return res.status(400).json({
                message: 'The student does not have a valid current class.',
            });
        }

        if (isStudentExcludedFromSubject(subjectDetails, studentDetails)) {
            return res.status(403).json({
                message: 'This student is excluded from this subject.',
                excluded: true,
            });
        }

        if (!isSubjectAssignedToStudent(subjectDetails, studentDetails)) {
            return res.status(403).json({
                message: `${subjectDetails.subjectName} is not assigned to this student's class or department.`,
            });
        }

        const termConfig = await TermStatus.findOne({
            academicYear,
            currentTerm: term,
        });

        if (termConfig?.isLocked) {
            return res.status(403).json({
                message: 'Access Denied: Results for this term are locked.',
            });
        }

        // This route preserves the old score format.
        const oldFields = {
            test1: validateScore(test1, 10),
            test2: validateScore(test2, 10),
            test3: validateScore(test3, 10),
            assignment: validateScore(assignment, 10),
            exam: validateScore(exam, 60),
        };

        for (const [field, value] of Object.entries(oldFields)) {
            if (value === false) {
                return res.status(400).json({
                    message: `Invalid ${field} score.`,
                });
            }
        }

        const existing = await Grade.findOne({
            student,
            subject,
            term,
            academicYear,
        });

        const updates = {};

        for (const field of Object.keys(oldFields)) {
            if (hasScore(req.body[field])) {
                updates[field] = oldFields[field];
            }
        }

        const merged = {
            test1: existing?.test1 ?? null,
            test2: existing?.test2 ?? null,
            notes: existing?.notes ?? null,
            oral: existing?.oral ?? null,
            exam: existing?.exam ?? null,
            ...updates,
        };

        // Legacy CA data is retained and is not silently converted
        // into the new CA structure.
        const newStructureComplete =
            ['test1', 'test2', 'notes', 'oral'].every((field) =>
                hasScore(merged[field])
            ) && hasScore(merged.exam);

        const calculated = newStructureComplete
            ? calculateCompletedResult(studentSection, merged)
            : {
                caSubmitted: false,
                examSubmitted: hasScore(merged.exam),
                totalScore: null,
                grade: null,
                remark: null,
            };

        const savedGrade = await Grade.findOneAndUpdate(
            { student, subject, term, academicYear },
            {
                $set: {
                    ...updates,
                    ...calculated,
                    manualNoInClass: hasScore(noInClass)
                        ? Number(noInClass)
                        : existing?.manualNoInClass ?? null,
                    gradedBy: req.user?.id,
                },
                $setOnInsert: {
                    student,
                    subject,
                    term,
                    academicYear,
                },
            },
            {
                returnDocument: 'after',
                upsert: true,
                runValidators: true,
            }
        );

        return res.status(200).json({
            message: 'Scores submitted successfully!',
            result: savedGrade,
        });
    } catch (error) {
        console.error('Submit Scores Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};

// ======================================================
// SUBMIT CA OR EXAM SCORES — NEW ROUTES
// ======================================================

const submitScoreComponent = async (req, res, componentType) => {
    try {
        const {
            student: studentId,
            term,
            academicYear,
            noInClass,
            scores,
        } = req.body;

        if (
            !studentId ||
            !mongoose.Types.ObjectId.isValid(studentId)
        ) {
            return res.status(400).json({
                message: 'A valid student ID is required.',
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(term)) {
            return res.status(400).json({
                message: 'A valid academic term is required.',
            });
        }

        if (!Array.isArray(scores) || scores.length === 0) {
            return res.status(400).json({
                message: 'Please provide at least one subject score.',
            });
        }

        const year = academicYear || await getCurrentAcademicYear();

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found.',
            });
        }

        const studentSection = getStudentSection(student);

        if (!studentSection) {
            return res.status(400).json({
                message: 'The student does not have a valid current class.',
            });
        }

        const termConfig = await TermStatus.findOne({
            academicYear: year,
            currentTerm: term,
        });

        if (termConfig?.isLocked) {
            return res.status(403).json({
                message: 'Access Denied: Results for this term are locked.',
            });
        }

        const subjectIds = scores.map((item) => item.subject);

        if (
            subjectIds.some(
                (id) => !id || !mongoose.Types.ObjectId.isValid(id)
            )
        ) {
            return res.status(400).json({
                message: 'One or more subject IDs are invalid.',
            });
        }

        if (new Set(subjectIds.map(String)).size !== subjectIds.length) {
            return res.status(400).json({
                message: 'A subject cannot appear more than once in a submission.',
            });
        }

        const subjects = await Subject.find({
            _id: { $in: subjectIds },
        });

        const subjectMap = new Map(
            subjects.map((subject) => [
                subject._id.toString(),
                subject,
            ])
        );

        if (subjects.length !== subjectIds.length) {
            return res.status(404).json({
                message: 'One or more subjects could not be found.',
            });
        }

        const fields = componentType === 'CA'
            ? ['test1', 'test2', 'notes', 'oral']
            : ['exam'];

        const limits = {
            test1: 10,
            test2: 20,
            notes: 5,
            oral: 5,
            exam: 60,
        };

        const savedGrades = [];

        for (const item of scores) {
            const subject = subjectMap.get(String(item.subject));

            if (isStudentExcludedFromSubject(subject, student)) {
                return res.status(403).json({
                    message: `This student is excluded from ${subject.subjectName}.`,
                    excluded: true,
                });
            }

            if (!isSubjectAssignedToStudent(subject, student)) {
                return res.status(403).json({
                    message: `${subject.subjectName} is not assigned to this student's class or department.`,
                });
            }

            const updates = {};

            for (const field of fields) {
                const rawValue = item[field];

                // Blank fields are ignored, not saved as zero.
                if (!hasScore(rawValue)) continue;

                const value = validateScore(rawValue, limits[field]);

                if (value === false) {
                    return res.status(400).json({
                        message: `${field} for ${subject.subjectName} must be between 0 and ${limits[field]}.`,
                    });
                }

                updates[field] = value;
            }

            // Do not create an empty Grade record for a subject
            // if every field in this submission is blank.
            if (Object.keys(updates).length === 0) continue;

            const existing = await Grade.findOne({
                student: student._id,
                subject: subject._id,
                term,
                academicYear: year,
            });

            const merged = {
                test1: existing?.test1 ?? null,
                test2: existing?.test2 ?? null,
                notes: existing?.notes ?? null,
                oral: existing?.oral ?? null,
                exam: existing?.exam ?? null,
                ...updates,
            };

            const calculated = calculateCompletedResult(
                studentSection,
                merged
            );

            const saved = await Grade.findOneAndUpdate(
                {
                    student: student._id,
                    subject: subject._id,
                    term,
                    academicYear: year,
                },
                {
                    $set: {
                        ...updates,
                        ...calculated,
                        manualNoInClass: hasScore(noInClass)
                            ? Number(noInClass)
                            : existing?.manualNoInClass ?? null,
                        gradedBy: req.user?.id,
                    },
                    $setOnInsert: {
                        student: student._id,
                        subject: subject._id,
                        term,
                        academicYear: year,
                    },
                },
                {
                    returnDocument: 'after',
                    upsert: true,
                    runValidators: true,
                }
            ).populate('subject', 'subjectName subjectCode');

            savedGrades.push(saved);
        }

        return res.status(200).json({
            message: `${componentType} scores saved successfully.`,
            student: {
                id: student._id,
                name:
                    student.name ||
                    `${student.firstName || ''} ${student.surname || ''}`.trim(),
                admissionNumber: student.admissionNumber,
            },
            count: savedGrades.length,
            results: savedGrades,
        });
    } catch (error) {
        console.error(`Submit ${componentType} Scores Error:`, error);

        return res.status(500).json({
            message: `Failed to save ${componentType} scores.`,
            error: error.message,
        });
    }
};

exports.submitCAScores = (req, res) =>
    submitScoreComponent(req, res, 'CA');

exports.submitExamScores = (req, res) =>
    submitScoreComponent(req, res, 'Exam');

// ======================================================
// SUBMIT MULTIPLE SUBJECT SCORES — LEGACY ROUTE
// Kept available for existing frontend integrations.
// ======================================================

exports.submitMultipleStudentScores = async (req, res) => {
    try {
        const {
            student: studentId,
            term,
            academicYear,
            noInClass,
            scores,
        } = req.body;

        if (
            !studentId ||
            !mongoose.Types.ObjectId.isValid(studentId)
        ) {
            return res.status(400).json({
                message: 'A valid student ID is required.',
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(term)) {
            return res.status(400).json({
                message: 'A valid academic term is required.',
            });
        }

        if (!Array.isArray(scores) || scores.length === 0) {
            return res.status(400).json({
                message: 'Please provide at least one subject score.',
            });
        }

        const year = academicYear || await getCurrentAcademicYear();

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found.',
            });
        }

        const studentSection = getStudentSection(student);

        if (!studentSection) {
            return res.status(400).json({
                message: 'The student does not have a valid current class.',
            });
        }

        const termConfig = await TermStatus.findOne({
            academicYear: year,
            currentTerm: term,
        });

        if (termConfig?.isLocked) {
            return res.status(403).json({
                message: 'Access Denied: Results for this term are locked.',
            });
        }

        const subjectIds = scores.map((item) => item.subject);

        if (
            subjectIds.some(
                (id) => !id || !mongoose.Types.ObjectId.isValid(id)
            )
        ) {
            return res.status(400).json({
                message: 'One or more subject IDs are invalid.',
            });
        }

        if (new Set(subjectIds.map(String)).size !== subjectIds.length) {
            return res.status(400).json({
                message: 'A subject cannot appear more than once in a submission.',
            });
        }

        const subjects = await Subject.find({
            _id: { $in: subjectIds },
        });

        const subjectMap = new Map(
            subjects.map((subject) => [
                subject._id.toString(),
                subject,
            ])
        );

        if (subjects.length !== subjectIds.length) {
            return res.status(404).json({
                message: 'One or more selected subjects could not be found.',
            });
        }

        const savedGrades = [];

        for (const item of scores) {
            const subject = subjectMap.get(String(item.subject));

            if (isStudentExcludedFromSubject(subject, student)) {
                return res.status(403).json({
                    message: `This student is excluded from ${subject.subjectName}.`,
                    excluded: true,
                });
            }

            if (!isSubjectAssignedToStudent(subject, student)) {
                return res.status(403).json({
                    message: `${subject.subjectName} is not assigned to this student's class or department.`,
                });
            }

            const existing = await Grade.findOne({
                student: student._id,
                subject: subject._id,
                term,
                academicYear: year,
            });

            const updates = {};

            // Accept both the new CA fields and legacy fields.
            const limits = {
                test1: 10,
                test2: 20,
                notes: 5,
                oral: 5,
                exam: 60,
            };

            for (const field of Object.keys(limits)) {
                if (!hasScore(item[field])) continue;

                const value = validateScore(item[field], limits[field]);

                if (value === false) {
                    return res.status(400).json({
                        message: `Invalid ${field} score for ${subject.subjectName}.`,
                    });
                }

                updates[field] = value;
            }

            if (Object.keys(updates).length === 0) continue;

            const merged = {
                test1: existing?.test1 ?? null,
                test2: existing?.test2 ?? null,
                notes: existing?.notes ?? null,
                oral: existing?.oral ?? null,
                exam: existing?.exam ?? null,
                ...updates,
            };

            const calculated = calculateCompletedResult(
                studentSection,
                merged
            );

            const saved = await Grade.findOneAndUpdate(
                {
                    student: student._id,
                    subject: subject._id,
                    term,
                    academicYear: year,
                },
                {
                    $set: {
                        ...updates,
                        ...calculated,
                        manualNoInClass: hasScore(noInClass)
                            ? Number(noInClass)
                            : existing?.manualNoInClass ?? null,
                        gradedBy: req.user?.id,
                    },
                    $setOnInsert: {
                        student: student._id,
                        subject: subject._id,
                        term,
                        academicYear: year,
                    },
                },
                {
                    returnDocument: 'after',
                    upsert: true,
                    runValidators: true,
                }
            ).populate('subject', 'subjectName subjectCode');

            savedGrades.push(saved);
        }

        return res.status(200).json({
            message: 'Student subject scores saved successfully.',
            student: {
                id: student._id,
                name:
                    student.name ||
                    `${student.firstName || ''} ${student.surname || ''}`.trim(),
                admissionNumber: student.admissionNumber,
            },
            count: savedGrades.length,
            results: savedGrades,
        });
    } catch (error) {
        console.error('Submit Multiple Student Scores Error:', error);

        return res.status(500).json({
            message: 'Failed to submit student scores.',
            error: error.message,
        });
    }
};

// ======================================================
// PUBLISH OR UNPUBLISH A TERM'S RESULTS
// ======================================================

exports.publishTermResults = async (req, res) => {
    try {
        const { academicYear, currentTerm, isPublished } = req.body;

        if (
            !academicYear ||
            !currentTerm ||
            typeof isPublished !== 'boolean'
        ) {
            return res.status(400).json({
                message: 'academicYear, currentTerm and isPublished are required.',
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(currentTerm)) {
            return res.status(400).json({
                message: 'Invalid term supplied.',
            });
        }

        const gradeCount = await Grade.countDocuments({
            academicYear,
            term: currentTerm,
        });

        if (isPublished && gradeCount === 0) {
            return res.status(400).json({
                message: `There are no submitted grades for ${currentTerm}, ${academicYear}.`,
            });
        }

        const updatedStatus = await TermStatus.findOneAndUpdate(
            { academicYear, currentTerm },
            {
                $set: { isPublished },
                $setOnInsert: {
                    isLocked: false,
                    nextTermBegins: '',
                },
            },
            {
                returnDocument: 'after',
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            }
        );

        return res.status(200).json({
            message: `Results for ${currentTerm} have been ${
                isPublished ? 'PUBLISHED' : 'UNPUBLISHED'
            }.`,
            status: updatedStatus,
        });
    } catch (error) {
        console.error('Publish Term Results Error:', error);

        return res.status(500).json({
            message: 'Failed to update result publication status.',
            error: error.message,
        });
    }
};

// ======================================================
// TOGGLE TERM LOCK — GLOBAL
// ======================================================

exports.toggleTermLock = async (req, res) => {
    try {
        const {
            academicYear,
            currentTerm,
            isLocked,
            nextTermBegins,
        } = req.body;

        if (
            !academicYear ||
            !currentTerm ||
            typeof isLocked !== 'boolean'
        ) {
            return res.status(400).json({
                message: 'Missing required fields.',
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(currentTerm)) {
            return res.status(400).json({
                message: 'Invalid term supplied.',
            });
        }

        const updatedStatus = await TermStatus.findOneAndUpdate(
            { academicYear, currentTerm },
            {
                $set: {
                    isLocked,
                    nextTermBegins: nextTermBegins || '',
                },
            },
            {
                returnDocument: 'after',
                upsert: true,
                runValidators: true,
            }
        );

        let newAcademicYear = null;

        if (currentTerm === 'Third Term' && isLocked === true) {
            const { advanceAcademicYear } = require('../utils/academicYear');

            newAcademicYear = await advanceAcademicYear(academicYear);
        }

        return res.status(200).json({
            message: `Term ${currentTerm} has been ${
                isLocked ? 'LOCKED' : 'UNLOCKED'
            }.`,
            status: updatedStatus,
            newAcademicYear,
        });
    } catch (error) {
        console.error('Toggle Term Lock Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};

// ======================================================
// INDIVIDUAL STUDENT RESULT LOCK
// ======================================================

exports.setStudentResultLock = async (req, res) => {
    try {
        const {
            studentId,
            academicYear,
            term,
            isLocked,
            reason,
        } = req.body;

        if (
            !studentId ||
            !academicYear ||
            !term ||
            typeof isLocked !== 'boolean'
        ) {
            return res.status(400).json({
                message: 'studentId, academicYear, term and isLocked are required.',
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(term)) {
            return res.status(400).json({
                message: 'Invalid term supplied.',
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found.',
            });
        }

        const lock = await ResultLock.findOneAndUpdate(
            { student: studentId, academicYear, term },
            {
                $set: {
                    isLocked,
                    reason: reason || '',
                    lockedBy: req.user?.id,
                },
            },
            {
                returnDocument: 'after',
                upsert: true,
                runValidators: true,
            }
        );

        return res.status(200).json({
            message: `Results for ${term} have been ${
                isLocked ? 'LOCKED' : 'UNLOCKED'
            } for this student.`,
            lock,
        });
    } catch (error) {
        console.error('setStudentResultLock error:', error);

        return res.status(500).json({
            message: 'Failed to update student result lock.',
            error: error.message,
        });
    }
};

exports.getStudentResultLocks = async (req, res) => {
    try {
        const { studentId, academicYear } = req.query;

        const filter = {};

        if (studentId) filter.student = studentId;

        if (academicYear) filter.academicYear = academicYear;

        const locks = await ResultLock.find(filter)
            .populate(
                'student',
                'name admissionNumber currentClass department'
            )
            .sort({ updatedAt: -1 });

        return res.status(200).json({
            count: locks.length,
            locks,
        });
    } catch (error) {
        console.error('getStudentResultLocks error:', error);

        return res.status(500).json({
            message: 'Failed to load result locks.',
            error: error.message,
        });
    }
};

// ======================================================
// STUDENT ACADEMIC PROFILE / ANNUAL REPORT
// ======================================================

exports.getStudentAcademicProfile = async (req, res) => {
    try {
        let studentId = req.params.studentId;

        const isStudent = req.user?.role === 'student';

        if (isStudent) {
            studentId = req.user.studentProfile;
        }

        if (!studentId) {
            return res.status(400).json({
                message: 'Student ID is required.',
            });
        }

        const term = req.query.term;

        if (
            term &&
            !['First Term', 'Second Term', 'Third Term'].includes(term)
        ) {
            return res.status(400).json({
                message: 'Invalid term supplied.',
            });
        }

        const academicYear =
            req.query.academicYear || await getCurrentAcademicYear();

        if (!academicYear) {
            return res.status(400).json({
                message: 'academicYear is required.',
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found.',
            });
        }

        let rawGrades = await Grade.find({
            student: studentId,
            academicYear,
        }).populate(
            'subject',
            'subjectName subjectCode section classAssignments'
        );

        if (!rawGrades.length) {
            return res.status(404).json({
                message: 'No academic records found for this year.',
            });
        }

        // Students only see published terms.
        if (isStudent) {
            const publishedStatuses = await TermStatus.find({
                academicYear,
                isPublished: true,
            }).select('currentTerm');

            const publishedTerms = new Set(
                publishedStatuses.map((status) => status.currentTerm)
            );

            rawGrades = rawGrades.filter((grade) =>
                publishedTerms.has(grade.term)
            );

            if (!rawGrades.length) {
                return res.status(403).json({
                    message: 'Your results for this academic year have not been published yet.',
                });
            }

            // Individual student result locks.
            const lockFilter = {
                student: studentId,
                academicYear,
                isLocked: true,
            };

            if (term) lockFilter.term = term;

            const locks = await ResultLock.find(lockFilter).select('term');

            if (term) {
                if (locks.length > 0) {
                    return res.status(403).json({
                        message: 'Your result for this term has been locked by the school administration. Please contact the office.',
                        locked: true,
                        term,
                        academicYear,
                    });
                }
            } else {
                const lockedTerms = new Set(
                    locks.map((lock) => lock.term)
                );

                if (lockedTerms.size > 0) {
                    rawGrades = rawGrades.filter(
                        (grade) => !lockedTerms.has(grade.term)
                    );
                }

                if (!rawGrades.length) {
                    return res.status(403).json({
                        message: 'Your results have been locked by the school administration. Please contact the school administration.',
                        locked: true,
                    });
                }
            }
        }

        const subjectsMap = {};

        rawGrades.forEach((grade) => {
            if (!grade.subject) return;

            const subjectId = grade.subject._id.toString();

            if (!subjectsMap[subjectId]) {
                subjectsMap[subjectId] = {
                    subjectId,
                    subjectName: grade.subject.subjectName,
                    subjectCode: grade.subject.subjectCode,
                    section: grade.subject.section,
                    terms: {
                        'First Term': null,
                        'Second Term': null,
                        'Third Term': null,
                    },
                };
            }

            const caSubmitted =
                grade.caSubmitted === true ||
                (
                    hasScore(grade.test1) &&
                    hasScore(grade.test2) &&
                    hasScore(grade.notes) &&
                    hasScore(grade.oral)
                );

            const examSubmitted =
                grade.examSubmitted === true || hasScore(grade.exam);

            const complete = caSubmitted && examSubmitted;

            const ca = caSubmitted
                ? Number(grade.test1) +
                  Number(grade.test2) +
                  Number(grade.notes) +
                  Number(grade.oral)
                : null;

            subjectsMap[subjectId].terms[grade.term] = {
                test1: grade.test1 ?? null,
                test2: grade.test2 ?? null,
                notes: grade.notes ?? null,
                oral: grade.oral ?? null,

                // Keep old fields available for legacy result views.
                test3: grade.test3 ?? null,
                assignment: grade.assignment ?? null,

                exam: examSubmitted ? grade.exam : null,

                ca,
                caSubmitted,
                examSubmitted,

                totalScore: complete ? grade.totalScore : null,
                grade: complete ? grade.grade : null,
                remark: complete ? grade.remark : null,
            };
        });

        const reportCardSummary = [];

        let totalAnnualScore = 0;
        let subjectCount = 0;

        const performanceGraph = {
            labels: ['First Term', 'Second Term', 'Third Term'],
            datasets: [],
        };

        for (const subjectId in subjectsMap) {
            const sub = subjectsMap[subjectId];

            const first = sub.terms['First Term'];
            const second = sub.terms['Second Term'];
            const third = sub.terms['Third Term'];

            const firstTermTotal =
                first?.totalScore ?? null;

            const secondTermTotal =
                second?.totalScore ?? null;

            const thirdTermTotal =
                third?.totalScore ?? null;

            let cumulativeSecond = null;
            let cumulativeThird = null;
            let annualAverage = null;

            if (
                firstTermTotal !== null &&
                secondTermTotal !== null
            ) {
                cumulativeSecond =
                    firstTermTotal + secondTermTotal;
            }

            if (
                firstTermTotal !== null &&
                secondTermTotal !== null &&
                thirdTermTotal !== null
            ) {
                cumulativeThird =
                    firstTermTotal +
                    secondTermTotal +
                    thirdTermTotal;

                annualAverage = Number(
                    (cumulativeThird / 3).toFixed(1)
                );
            } else if (cumulativeSecond !== null) {
                annualAverage = Number(
                    (cumulativeSecond / 2).toFixed(1)
                );
            } else if (firstTermTotal !== null) {
                annualAverage = firstTermTotal;
            }

            let displayData = {};

            if (term === 'First Term') {
                displayData = {
                    firstTerm: first,
                };
            } else if (term === 'Second Term') {
                displayData = {
                    firstTermTotal,
                    secondTerm: second,
                    cumulativeSecondTerm: cumulativeSecond,
                };
            } else {
                displayData = {
                    firstTermTotal,
                    secondTermTotal,
                    thirdTerm: third,
                    cumulativeSecondTerm: cumulativeSecond,
                    cumulativeThirdTerm: cumulativeThird,
                    annualAverage,
                    annualGrade:
                        annualAverage !== null
                            ? getWAECGrade(annualAverage).annualGrade
                            : null,
                    annualRemark:
                        annualAverage !== null
                            ? getWAECGrade(annualAverage).annualRemark
                            : null,
                };

                if (annualAverage !== null) {
                    totalAnnualScore += annualAverage;
                    subjectCount++;
                }
            }

            performanceGraph.datasets.push({
                subject: sub.subjectName,
                subjectCode: sub.subjectCode,
                data: [
                    firstTermTotal,
                    secondTermTotal,
                    thirdTermTotal,
                ],
            });

            reportCardSummary.push({
                subjectName: sub.subjectName,
                subjectCode: sub.subjectCode,
                ...displayData,
            });
        }

        const overallAverage =
            subjectCount > 0
                ? Number(
                    (totalAnnualScore / subjectCount).toFixed(1)
                )
                : null;

        const overallGradeInfo =
            overallAverage !== null
                ? getWAECGrade(overallAverage)
                : null;

        const hasAllThreeTerms = rawGrades.some(
            (grade) => grade.term === 'Third Term'
        );

        const studentName =
            student.name ||
            `${student.firstName || ''} ${student.surname || ''}`.trim();

        let classSize = await getClassSize(student);

        if (!classSize) {
            const gradeWithManual = rawGrades.find(
                (grade) =>
                    grade.manualNoInClass != null &&
                    grade.manualNoInClass !== ''
            );

            if (gradeWithManual) {
                classSize = Number(gradeWithManual.manualNoInClass);
            }
        }

        const response = {
            student: {
                id: student._id,
                name: studentName,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                department: student.department || null,
                gender: student.gender,
            },
            academicYear,
            view: term || 'Full Annual Report',
            classSize: classSize || null,
            noInClass: classSize || null,
            studentsInClass: classSize || null,
            reportCardSummary,
            performanceGraph,
        };

        if (!term) {
            response.overallAverage = overallAverage;
            response.overallGrade =
                overallGradeInfo?.annualGrade || null;
            response.overallRemark =
                overallGradeInfo?.annualRemark || null;

            response.yearTutorComment = hasAllThreeTerms
                ? getAutomaticYearTutorComment(overallAverage)
                : null;

            response.adminComment = hasAllThreeTerms
                ? getAutomaticAdminComment(overallAverage)
                : null;
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error('Get Student Academic Profile Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};

// ======================================================
// CLASS PERFORMANCE
// ======================================================

exports.getClassPerformanceMetrics = async (req, res) => {
    try {
        return res.status(200).json({
            message: 'Class Performance Metrics endpoint working',
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};

// ======================================================
// GET ALL GRADES — ADMIN AND TEACHER
// ======================================================

exports.getAllGrades = async (req, res) => {
    try {
        const grades = await Grade.find()
            .populate(
                'student',
                'firstName surname name admissionNumber currentClass department'
            )
            .populate(
                'subject',
                'subjectName subjectCode section'
            )
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: grades.length,
            grades,
        });
    } catch (error) {
        console.error('Get All Grades Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};

// ======================================================
// GET TERM STATUSES — ADMIN ONLY
// ======================================================

exports.getTermStatuses = async (req, res) => {
    try {
        const academicYear =
            req.query.academicYear || await getCurrentAcademicYear();

        if (!academicYear) {
            return res.status(400).json({
                message: 'academicYear is required.',
            });
        }

        const statuses = await TermStatus.find({
            academicYear,
        }).sort({
            currentTerm: 1,
        });

        return res.status(200).json({
            academicYear,
            statuses,
        });
    } catch (error) {
        console.error('Get Term Statuses Error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve term statuses.',
            error: error.message,
        });
    }
};

console.log('Grade Controller Loaded Successfully');
