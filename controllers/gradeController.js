// controllers/gradeController.js
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const TermStatus = require('../models/TermStatus');

const { 
    calculateGrade, 
    getAutomaticYearTutorComment, 
    getAutomaticAdminComment 
} = require('../utils/gradeCalculator');

// Helper function
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

// get students by subject
exports.getStudentsBySubject = async (req, res) => {
    try {
        const { subjectId } = req.params;

        const subjectData = await Subject.findById(subjectId)
            .populate('enrolledStudents', 'name email admissionNumber');

        if (!subjectData) {
            return res.status(404).json({ message: "Subject not found." });
        }

        res.status(200).json({
            subjectName: subjectData.subjectName,
            section: subjectData.section,
            students: subjectData.enrolledStudents
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// submit scores
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
            test1, test2, test3, assignment, exam, noInClass 
        } = req.body;

        const Student = require('../models/Student');

        // Find Student
        if (!student && admissionNumber) {
            const studentDoc = await Student.findOne({ admissionNumber });
            if (!studentDoc) {
                return res.status(404).json({ message: `Student not found: ${admissionNumber}` });
            }
            student = studentDoc._id;
        }

        if (!student && studentName) {
            const studentDoc = await Student.findOne({ 
                name: { $regex: studentName, $options: 'i' }
            });
            if (!studentDoc) {
                return res.status(404).json({ message: `Student not found: ${studentName}` });
            }
            student = studentDoc._id;
        }

        // Find Subject
        if (!subject && subjectCode) {
            const subjectDoc = await Subject.findOne({ 
                subjectCode: subjectCode.toUpperCase() 
            });
            if (!subjectDoc) {
                return res.status(404).json({ message: `Subject not found: ${subjectCode}` });
            }
            subject = subjectDoc._id;
        }

        if (!subject && subjectName) {
            const subjectDoc = await Subject.findOne({ 
                subjectName: { $regex: subjectName, $options: 'i' }
            });
            if (!subjectDoc) {
                return res.status(404).json({ message: `Subject not found: ${subjectName}` });
            }
            subject = subjectDoc._id;
        }

        if (!student || !subject) {
            return res.status(400).json({ 
                message: "Please provide student + subject using IDs, names, or (admissionNumber + subjectCode)" 
            });
        }

        const termConfig = await TermStatus.findOne({ academicYear, currentTerm: term });
        if (termConfig?.isLocked) {
            return res.status(403).json({ message: "Access Denied: Results for this term are locked." });
        }

        const totalCA = (Number(test1)||0) + (Number(test2)||0) + (Number(test3)||0) + (Number(assignment)||0);
        if (totalCA > 40) return res.status(400).json({ message: `Cumulative CA (${totalCA}) cannot exceed 40.` });
        if (Number(exam) > 60) return res.status(400).json({ message: `Exam score (${exam}) cannot exceed 60.` });

        const subjectDetails = await Subject.findById(subject);
        if (!subjectDetails) return res.status(404).json({ message: "Subject not found." });

        const { totalScore, grade, remark } = calculateGrade(subjectDetails.section, test1, test2, test3, assignment, exam);

        const savedGrade = await Grade.findOneAndUpdate(
            { student, subject, term, academicYear },
            { 
                test1, test2, test3, assignment, exam, 
                totalScore, grade, remark,
                manualNoInClass: noInClass ? Number(noInClass) : null,
                gradedBy: req.user?.id 
            },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ 
            message: "Scores submitted successfully!", 
            result: savedGrade 
        });

    } catch (error) {
        console.error("Submit Scores Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// toggle term lock
exports.toggleTermLock = async (req, res) => {
    try {
        const { academicYear, currentTerm, isLocked, nextTermBegins } = req.body;
        if (!academicYear || !currentTerm || typeof isLocked !== 'boolean') {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const updatedStatus = await TermStatus.findOneAndUpdate(
            { academicYear, currentTerm },
            { isLocked, nextTermBegins: nextTermBegins || "" },
            { new: true, upsert: true }
        );

        res.status(200).json({
            message: `Term ${currentTerm} has been ${isLocked ? 'LOCKED' : 'UNLOCKED'}`,
            status: updatedStatus
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// students academic profile / annual report
exports.getStudentAcademicProfile = async (req, res) => {
    try {
        let studentId = req.params.studentId;
        if (req.user?.role === 'student') {
            studentId = req.user.studentProfile;
        }

        const { academicYear } = req.query;
        if (!academicYear) {
            return res.status(400).json({ message: "academicYear is required" });
        }

        const Student = require('../models/Student');
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const rawGrades = await Grade.find({ student: studentId, academicYear })
            .populate('subject', 'subjectName subjectCode section');

        if (!rawGrades.length) {
            return res.status(404).json({ message: "No academic records found for this year" });
        }

        const subjectsMap = {};

        rawGrades.forEach(grade => {
            const subjectId = grade.subject._id.toString();
            if (!subjectsMap[subjectId]) {
                subjectsMap[subjectId] = {
                    subjectId,
                    subjectName: grade.subject.subjectName,
                    subjectCode: grade.subject.subjectCode,
                    section: grade.subject.section,
                    terms: {
                        "First Term": null,
                        "Second Term": null,
                        "Third Term": null
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
            labels: ["First Term", "Second Term", "Third Term"],
            datasets: []
        };

        for (const subjectId in subjectsMap) {
            const sub = subjectsMap[subjectId];
            const first = sub.terms["First Term"];
            const second = sub.terms["Second Term"];
            const third = sub.terms["Third Term"];

            let cumulativeSecond = null;
            let cumulativeThird = null;
            let annualAverage = null;

            if (first && second) {
                cumulativeSecond = Number(((first.totalScore + second.totalScore) / 2).toFixed(1));
            }

            if (first && second && third) {
                cumulativeThird = Number(((first.totalScore + second.totalScore + third.totalScore) / 3).toFixed(1));
                annualAverage = cumulativeThird;
            } else if (first && second) {
                annualAverage = cumulativeSecond;
            } else if (first) {
                annualAverage = first.totalScore;
            }

            if (annualAverage !== null) {
                totalAnnualScore += annualAverage;
                subjectCount++;
            }

            performanceGraph.datasets.push({
                subject: sub.subjectName,
                subjectCode: sub.subjectCode,
                data: [
                    first ? first.totalScore : null,
                    second ? second.totalScore : null,
                    third ? third.totalScore : null
                ]
            });

            reportCardSummary.push({
                subjectName: sub.subjectName,
                subjectCode: sub.subjectCode,
                firstTerm: first,
                secondTerm: second,
                thirdTerm: third,
                cumulativeSecondTerm: cumulativeSecond,
                cumulativeThirdTerm: cumulativeThird,
                annualAverage: annualAverage,
                annualGrade: annualAverage !== null ? getWAECGrade(annualAverage).annualGrade : null,
                annualRemark: annualAverage !== null ? getWAECGrade(annualAverage).annualRemark : null
            });
        }

        const overallAverage = subjectCount > 0 
            ? Number((totalAnnualScore / subjectCount).toFixed(1)) 
            : 0;

        const overallGradeInfo = getWAECGrade(overallAverage);
        const hasAllThreeTerms = rawGrades.some(g => g.term === "Third Term");

        res.status(200).json({
            student: {
                id: student._id,
                name: student.name,
                admissionNumber: student.admissionNumber,
                currentClass: student.currentClass,
                gender: student.gender
            },
            academicYear,
            overallAverage,
            overallGrade: overallGradeInfo.annualGrade,
            overallRemark: overallGradeInfo.annualRemark,
            yearTutorComment: hasAllThreeTerms ? getAutomaticYearTutorComment(overallAverage) : null,
            adminComment: hasAllThreeTerms ? getAutomaticAdminComment(overallAverage) : null,
            reportCardSummary,
            performanceGraph
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// class performance
exports.getClassPerformanceMetrics = async (req, res) => {
    try {
        res.status(200).json({ message: "Class Performance Metrics endpoint working" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

console.log("Grade Controller Loaded Successfully");