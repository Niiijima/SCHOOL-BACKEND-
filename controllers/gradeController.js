
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const TermStatus = require('../models/TermStatus');
const Student = require('../models/Student');

const {
    calculateGrade,
    getAutomaticYearTutorComment,
    getAutomaticAdminComment
} = require('../utils/gradeCalculator');

const { getCurrentAcademicYear } = require('../utils/academicYear');

// ======================================================
// HELPERS
// ======================================================

// WAEC annual grade
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

// Normalize department names.
const normalizeDepartment = (department) => {
    if (!department) return null;

    const value = String(department).trim();

    if (value.toLowerCase() === 'art') return 'Arts';

    return value;
};

// Only SS2 and SS3 require departments.
const requiresDepartment = (className) => {
    const normalizedClass = String(className || '')
        .trim()
        .toUpperCase();

    return ['SS2', 'SS3'].includes(normalizedClass);
};

// Check whether a subject is assigned to a student's class and department.
const isSubjectAssignedToStudent = (subject, student) => {
    if (!subject.classAssignments || subject.classAssignments.length === 0) {
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

        // JSS1-JSS3 and SS1 do not use departments.
        if (!requiresDepartment(studentClass)) return true;

        return normalizeDepartment(assignment.department) === studentDepartment;
    });
};

// Get JSS or SSS from the student's current class.
const getStudentSection = (student) => {
    const currentClass = String(student.currentClass || '')
        .trim()
        .toUpperCase();

    if (currentClass.startsWith('JSS')) return 'JSS';
    if (currentClass.startsWith('SS')) return 'SSS';

    return null;
};

// ======================================================
// GET STUDENTS BY SUBJECT
// ======================================================

exports.getStudentsBySubject = async (req, res) => {
    try {
        const { subjectId } = req.params;

        const subjectData = await Subject.findById(subjectId)
            .populate(
                'enrolledStudents',
                'name firstName surname email admissionNumber currentClass department'
            );

        if (!subjectData) {
            return res.status(404).json({
                message: 'Subject not found.'
            });
        }

        return res.status(200).json({
            subjectName: subjectData.subjectName,
            subjectCode: subjectData.subjectCode,
            section: subjectData.section,
            classAssignments: subjectData.classAssignments,
            students: subjectData.enrolledStudents
        });

    } catch (error) {
        console.error('Get Students By Subject Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// ======================================================
// SUBMIT STUDENT SCORES
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
            noInClass
        } = req.body;

        // Default academic year if not provided.
        if (!academicYear) {
            academicYear = await getCurrentAcademicYear();
        }

        // Find student using admission number.
        if (!student && admissionNumber) {
            const studentDoc = await Student.findOne({ admissionNumber });

            if (!studentDoc) {
                return res.status(404).json({
                    message: `Student not found: ${admissionNumber}`
                });
            }

            student = studentDoc._id;
        }

        // Find student using name.
        if (!student && studentName) {
            const studentDoc = await Student.findOne({
                $or: [
                    { name: { $regex: studentName, $options: 'i' } },
                    { firstName: { $regex: studentName, $options: 'i' } },
                    { surname: { $regex: studentName, $options: 'i' } }
                ]
            });

            if (!studentDoc) {
                return res.status(404).json({
                    message: `Student not found: ${studentName}`
                });
            }

            student = studentDoc._id;
        }

        // Find subject using subject code.
        if (!subject && subjectCode) {
            const subjectDoc = await Subject.findOne({
                subjectCode: subjectCode.toUpperCase()
            });

            if (!subjectDoc) {
                return res.status(404).json({
                    message: `Subject not found: ${subjectCode}`
                });
            }

            subject = subjectDoc._id;
        }

        // Find subject using subject name.
        if (!subject && subjectName) {
            const subjectDoc = await Subject.findOne({
                subjectName: { $regex: subjectName, $options: 'i' }
            });

            if (!subjectDoc) {
                return res.status(404).json({
                    message: `Subject not found: ${subjectName}`
                });
            }

            subject = subjectDoc._id;
        }

        if (!student || !subject) {
            return res.status(400).json({
                message: 'Please provide student and subject using IDs, names, or admissionNumber and subjectCode.'
            });
        }

        if (!term) {
            return res.status(400).json({
                message: 'term is required.'
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(term)) {
            return res.status(400).json({
                message: 'Invalid term supplied.'
            });
        }

        // Load full student and subject records.
        const studentDetails = await Student.findById(student);
        const subjectDetails = await Subject.findById(subject);

        if (!studentDetails) {
            return res.status(404).json({
                message: 'Student not found.'
            });
        }

        if (!subjectDetails) {
            return res.status(404).json({
                message: 'Subject not found.'
            });
        }

        // Validate student's class.
        const studentSection = getStudentSection(studentDetails);

        if (!studentSection) {
            return res.status(400).json({
                message: 'The student does not have a valid current class.'
            });
        }

        // Validate subject assignment.
        if (!isSubjectAssignedToStudent(subjectDetails, studentDetails)) {
            return res.status(403).json({
                message: `${subjectDetails.subjectName} is not assigned to ${studentDetails.currentClass}${requiresDepartment(studentDetails.currentClass) && studentDetails.department ? ` (${studentDetails.department})` : ''}.`
            });
        }

        // Check whether the term is locked.
        const termConfig = await TermStatus.findOne({
            academicYear,
            currentTerm: term
        });

        if (termConfig?.isLocked) {
            return res.status(403).json({
                message: 'Access Denied: Results for this term are locked.'
            });
        }

        // Validate scores.
        const scoreValues = [test1, test2, test3, assignment, exam];

        const hasInvalidScore = scoreValues.some((score) => {
            if (score === undefined || score === null || score === '') {
                return false;
            }

            const value = Number(score);

            return !Number.isFinite(value) || value < 0;
        });

        if (hasInvalidScore) {
            return res.status(400).json({
                message: 'Scores must be valid non-negative numbers.'
            });
        }

        const totalCA =
            (Number(test1) || 0) +
            (Number(test2) || 0) +
            (Number(test3) || 0) +
            (Number(assignment) || 0);

        if (totalCA > 40) {
            return res.status(400).json({
                message: `Cumulative CA (${totalCA}) cannot exceed 40.`
            });
        }

        if ((Number(exam) || 0) > 60) {
            return res.status(400).json({
                message: `Exam score (${exam}) cannot exceed 60.`
            });
        }

        // Calculate grade according to the student's school section.
        const { totalScore, grade, remark } = calculateGrade(
            studentSection,
            test1,
            test2,
            test3,
            assignment,
            exam
        );

        // Save or update the student's grade.
        const savedGrade = await Grade.findOneAndUpdate(
            {
                student,
                subject,
                term,
                academicYear
            },
            {
                test1,
                test2,
                test3,
                assignment,
                exam,
                totalScore,
                grade,
                remark,
                manualNoInClass:
                    noInClass !== undefined &&
                    noInClass !== null &&
                    noInClass !== ''
                        ? Number(noInClass)
                        : null,
                gradedBy: req.user?.id
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        return res.status(200).json({
            message: 'Scores submitted successfully!',
            result: savedGrade
        });

    } catch (error) {
        console.error('Submit Scores Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};


// ======================================================
// SUBMIT MULTIPLE SUBJECT SCORES FOR ONE STUDENT
// ======================================================

exports.submitMultipleStudentScores = async (req, res) => {
    try {
        const {
            student: studentId,
            term,
            academicYear,
            noInClass,
            scores
        } = req.body;

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({
                message: 'A valid student ID is required.'
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(term)) {
            return res.status(400).json({
                message: 'A valid academic term is required.'
            });
        }

        if (!Array.isArray(scores) || scores.length === 0) {
            return res.status(400).json({
                message: 'Please provide at least one subject score.'
            });
        }

        const year = academicYear || await getCurrentAcademicYear();

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found.'
            });
        }

        const studentSection = getStudentSection(student);

        if (!studentSection) {
            return res.status(400).json({
                message: 'The student does not have a valid current class.'
            });
        }

        // Check whether the term is locked.
        const termConfig = await TermStatus.findOne({
            academicYear: year,
            currentTerm: term
        });

        if (termConfig?.isLocked) {
            return res.status(403).json({
                message: 'Access Denied: Results for this term are locked.'
            });
        }

        // Validate subject IDs and prevent duplicate entries.
        const subjectIds = scores.map((item) => item.subject);

        if (
            subjectIds.some(
                (id) => !id || !mongoose.Types.ObjectId.isValid(id)
            )
        ) {
            return res.status(400).json({
                message: 'One or more subject IDs are invalid.'
            });
        }

        if (new Set(subjectIds.map(String)).size !== subjectIds.length) {
            return res.status(400).json({
                message: 'A subject cannot appear more than once in the same submission.'
            });
        }

        const subjects = await Subject.find({
            _id: { $in: subjectIds }
        });

        const subjectMap = new Map(
            subjects.map((subject) => [
                subject._id.toString(),
                subject
            ])
        );

        if (subjects.length !== subjectIds.length) {
            return res.status(404).json({
                message: 'One or more selected subjects could not be found.'
            });
        }

        // Validate every subject and score before saving anything.
        const operations = [];

        for (const item of scores) {
            const subject = subjectMap.get(String(item.subject));

            if (!isSubjectAssignedToStudent(subject, student)) {
                return res.status(403).json({
                    message: `${subject.subjectName} is not assigned to this student's class or department.`
                });
            }

            const fields = [
                'test1',
                'test2',
                'test3',
                'assignment',
                'exam'
            ];

            const values = {};

            for (const field of fields) {
                const value = item[field];

                if (
                    value === undefined ||
                    value === null ||
                    value === '' ||
                    !Number.isFinite(Number(value)) ||
                    Number(value) < 0
                ) {
                    return res.status(400).json({
                        message: `Please provide a valid ${field} score for ${subject.subjectName}.`
                    });
                }

                values[field] = Number(value);
            }

            const totalCA =
                values.test1 +
                values.test2 +
                values.test3 +
                values.assignment;

            if (totalCA > 40) {
                return res.status(400).json({
                    message: `CA scores for ${subject.subjectName} cannot exceed 40.`
                });
            }

            if (values.exam > 60) {
                return res.status(400).json({
                    message: `Exam score for ${subject.subjectName} cannot exceed 60.`
                });
            }

            const { totalScore, grade, remark } = calculateGrade(
                studentSection,
                values.test1,
                values.test2,
                values.test3,
                values.assignment,
                values.exam
            );

            operations.push({
                updateOne: {
                    filter: {
                        student: student._id,
                        subject: subject._id,
                        term,
                        academicYear: year
                    },
                    update: {
                        $set: {
                            ...values,
                            totalScore,
                            grade,
                            remark,
                            manualNoInClass:
                                noInClass !== undefined &&
                                noInClass !== null &&
                                noInClass !== ''
                                    ? Number(noInClass)
                                    : null
                        }
                    },
                    upsert: true
                }
            });
        }

        // Save all validated subject scores together.
        await Grade.bulkWrite(operations, { ordered: true });

        const savedGrades = await Grade.find({
            student: student._id,
            subject: { $in: subjectIds },
            term,
            academicYear: year
        }).populate('subject', 'subjectName subjectCode');

        return res.status(200).json({
            message: 'All student subject scores submitted successfully!',
            student: {
                id: student._id,
                name: `${student.firstName} ${student.surname}`.trim(),
                admissionNumber: student.admissionNumber
            },
            count: savedGrades.length,
            results: savedGrades
        });

    } catch (error) {
        console.error('Submit Multiple Student Scores Error:', error);

        return res.status(500).json({
            message: 'Failed to submit student scores.',
            error: error.message
        });
    }
};


// ======================================================
// PUBLISH OR UNPUBLISH A TERM'S RESULTS
// ADMIN ONLY
// ======================================================

exports.publishTermResults = async (req, res) => {
    try {
        const {
            academicYear,
            currentTerm,
            isPublished
        } = req.body;

        if (!academicYear || !currentTerm || typeof isPublished !== 'boolean') {
            return res.status(400).json({
                message: 'academicYear, currentTerm and isPublished are required.'
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(currentTerm)) {
            return res.status(400).json({
                message: 'Invalid term supplied.'
            });
        }

        // Ensure there are results to publish.
        const gradeCount = await Grade.countDocuments({
            academicYear,
            term: currentTerm
        });

        if (isPublished && gradeCount === 0) {
            return res.status(400).json({
                message: `There are no submitted grades for ${currentTerm}, ${academicYear}.`
            });
        }

        // Save publication status without changing the lock status.
        const updatedStatus = await TermStatus.findOneAndUpdate(
            {
                academicYear,
                currentTerm
            },
            {
                $set: {
                    isPublished
                },
                $setOnInsert: {
                    isLocked: false,
                    nextTermBegins: ''
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.status(200).json({
            message: `Results for ${currentTerm} have been ${isPublished ? 'PUBLISHED' : 'UNPUBLISHED'}.`,
            status: updatedStatus
        });

    } catch (error) {
        console.error('Publish Term Results Error:', error);

        return res.status(500).json({
            message: 'Failed to update result publication status.',
            error: error.message
        });
    }
};

// ======================================================
// TOGGLE TERM LOCK
// ======================================================

exports.toggleTermLock = async (req, res) => {
    try {
        const {
            academicYear,
            currentTerm,
            isLocked,
            nextTermBegins
        } = req.body;

        if (!academicYear || !currentTerm || typeof isLocked !== 'boolean') {
            return res.status(400).json({
                message: 'Missing required fields.'
            });
        }

        if (!['First Term', 'Second Term', 'Third Term'].includes(currentTerm)) {
            return res.status(400).json({
                message: 'Invalid term supplied.'
            });
        }

        const updatedStatus = await TermStatus.findOneAndUpdate(
            {
                academicYear,
                currentTerm
            },
            {
                $set: {
                    isLocked,
                    nextTermBegins: nextTermBegins || ''
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        let newAcademicYear = null;

        // Advance academic year when Third Term is locked.
        if (currentTerm === 'Third Term' && isLocked === true) {
            const { advanceAcademicYear } = require('../utils/academicYear');

            newAcademicYear = await advanceAcademicYear(academicYear);
        }

        return res.status(200).json({
            message: `Term ${currentTerm} has been ${isLocked ? 'LOCKED' : 'UNLOCKED'}.`,
            status: updatedStatus,
            newAcademicYear
        });

    } catch (error) {
        console.error('Toggle Term Lock Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
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

        // Students can only view their own report.
        if (isStudent) {
            studentId = req.user.studentProfile;
        }

        if (!studentId) {
            return res.status(400).json({
                message: 'Student ID is required.'
            });
        }

        const term = req.query.term;

        if (
            term &&
            !['First Term', 'Second Term', 'Third Term'].includes(term)
        ) {
            return res.status(400).json({
                message: 'Invalid term supplied.'
            });
        }

        const academicYear =
            req.query.academicYear || await getCurrentAcademicYear();

        if (!academicYear) {
            return res.status(400).json({
                message: 'academicYear is required.'
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                message: 'Student not found.'
            });
        }

        let rawGrades = await Grade.find({
            student: studentId,
            academicYear
        }).populate(
            'subject',
            'subjectName subjectCode section classAssignments'
        );

        if (!rawGrades.length) {
            return res.status(404).json({
                message: 'No academic records found for this year.'
            });
        }

        // IMPORTANT:
        // Students only receive grades belonging to published terms.
        // Admins and teachers can still view all saved grades.
        if (isStudent) {
            const publishedStatuses = await TermStatus.find({
                academicYear,
                isPublished: true
            }).select('currentTerm');

            const publishedTerms = new Set(
                publishedStatuses.map((status) => status.currentTerm)
            );

            rawGrades = rawGrades.filter((grade) =>
                publishedTerms.has(grade.term)
            );

            if (!rawGrades.length) {
                return res.status(403).json({
                    message: 'Your results for this academic year have not been published yet.'
                });
            }
        }

        // Group grades by subject.
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
                        'Third Term': null
                    }
                };
            }

            subjectsMap[subjectId].terms[grade.term] = {
                test1: grade.test1,
                test2: grade.test2,
                test3: grade.test3,
                assignment: grade.assignment,
                exam: grade.exam,
                totalScore: grade.totalScore,
                grade: grade.grade,
                remark: grade.remark
            };
        });

        const reportCardSummary = [];
        let totalAnnualScore = 0;
        let subjectCount = 0;

        const performanceGraph = {
            labels: ['First Term', 'Second Term', 'Third Term'],
            datasets: []
        };

        for (const subjectId in subjectsMap) {
            const sub = subjectsMap[subjectId];

            const first = sub.terms['First Term'];
            const second = sub.terms['Second Term'];
            const third = sub.terms['Third Term'];

            const firstTermTotal = first ? first.totalScore : null;
            const secondTermTotal = second ? second.totalScore : null;
            const thirdTermTotal = third ? third.totalScore : null;

            let cumulativeSecond = null;
            let cumulativeThird = null;
            let annualAverage = null;

            if (first && second) {
                cumulativeSecond = first.totalScore + second.totalScore;
            }

            if (first && second && third) {
                cumulativeThird =
                    first.totalScore +
                    second.totalScore +
                    third.totalScore;

                annualAverage = Number((cumulativeThird / 3).toFixed(1));

            } else if (first && second) {
                annualAverage = Number((cumulativeSecond / 2).toFixed(1));

            } else if (first) {
                annualAverage = first.totalScore;
            }

            let displayData = {};

            if (term === 'First Term') {
                displayData = {
                    firstTerm: first
                };

            } else if (term === 'Second Term') {
                displayData = {
                    firstTermTotal,
                    secondTerm: second,
                    cumulativeSecondTerm: cumulativeSecond
                };

            } else {
                displayData = {
                    firstTermTotal,
                    secondTermTotal,
                    thirdTerm: third,
                    cumulativeSecondTerm: cumulativeSecond,
                    cumulativeThirdTerm: cumulativeThird,
                    annualAverage,
                    annualGrade: annualAverage !== null
                        ? getWAECGrade(annualAverage).annualGrade
                        : null,
                    annualRemark: annualAverage !== null
                        ? getWAECGrade(annualAverage).annualRemark
                        : null
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
                    thirdTermTotal
                ]
            });

            reportCardSummary.push({
                subjectName: sub.subjectName,
                subjectCode: sub.subjectCode,
                ...displayData
            });
        }

        const overallAverage = subjectCount > 0
            ? Number((totalAnnualScore / subjectCount).toFixed(1))
            : null;

        const overallGradeInfo = overallAverage !== null
            ? getWAECGrade(overallAverage)
            : null;

        const hasAllThreeTerms = rawGrades.some(
            (grade) => grade.term === 'Third Term'
        );

        const studentName =
            student.name ||
            `${student.firstName || ''} ${student.surname || ''}`.trim();

        const response = {
            student: {
                id: student._id,
                name: studentName,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                gender: student.gender
            },
            academicYear,
            view: term || 'Full Annual Report',
            reportCardSummary,
            performanceGraph
        };

        if (!term) {
            response.overallAverage = overallAverage;
            response.overallGrade = overallGradeInfo?.annualGrade || null;
            response.overallRemark = overallGradeInfo?.annualRemark || null;

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
            error: error.message
        });
    }
};

// ======================================================
// CLASS PERFORMANCE
// ======================================================

exports.getClassPerformanceMetrics = async (req, res) => {
    try {
        return res.status(200).json({
            message: 'Class Performance Metrics endpoint working'
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Server error',
            error: error.message
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

        console.log(
            'GRADE RELATIONSHIP CHECK:',
            JSON.stringify(
                grades.slice(0, 5).map((grade) => ({
                    gradeId: grade._id,
                    student: grade.student,
                    subject: grade.subject,
                    term: grade.term,
                    academicYear: grade.academicYear
                })),
                null,
                2
            )
        );

        return res.status(200).json({
            count: grades.length,
            grades
        });

    } catch (error) {
        console.error('Get All Grades Error:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// GET TERM PUBLICATION AND LOCK STATUSES — ADMIN ONLY
exports.getTermStatuses = async (req, res) => {
    try {
        const academicYear =
            req.query.academicYear || await getCurrentAcademicYear();

        if (!academicYear) {
            return res.status(400).json({
                message: 'academicYear is required.'
            });
        }

        const statuses = await TermStatus.find({
            academicYear
        }).sort({ currentTerm: 1 });

        return res.status(200).json({
            academicYear,
            statuses
        });

    } catch (error) {
        console.error('Get Term Statuses Error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve term statuses.',
            error: error.message
        });
    }
};


console.log('Grade Controller Loaded Successfully');
