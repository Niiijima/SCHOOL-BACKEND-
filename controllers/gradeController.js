const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const TermStatus = require('../models/TermStatus');
const calculateGrade = require('../utils/gradeCalculator');

// PIPELINE STEP 1: Fetch all students enrolled in a specific subject
exports.getStudentsBySubject = async (req, res) => {
    try {
        const { subjectId } = req.params;

        // Find the subject and pull down its student roster
        const subjectData = await Subject.findById(subjectId)
            .populate('enrolledStudents', 'name email admissionNumber');

        if (!subjectData) {
            return res.status(404).json({ message: "Subject class not found." });
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

// PIPELINE STEP 2: Input scores, auto-calculate grade totals, and save
exports.submitStudentScores = async (req, res) => {
    try {
        const { student, subject, term, academicYear, test1, test2, test3, assignment, exam } = req.body;

        // 1. Check if the Admin has locked results for this term
        const termConfig = await TermStatus.findOne({ academicYear, currentTerm: term });
        if (termConfig && termConfig.isLocked) {
            return res.status(403).json({ 
                message: "Access Denied: Results for this term have been locked by the administrator and cannot be modified." 
            });
        }

        // 2. Fetch the subject to see if it's JSS or SSS
        const subjectDetails = await Subject.findById(subject);
        if (!subjectDetails) {
            return res.status(404).json({ message: "Subject not found." });
        }

        // 3. Compute the grading metrics automatically using our utility engine
        const { totalScore, grade, remark } = calculateGrade(
            subjectDetails.section,
            test1,
            test2,
            test3,
            assignment,
            exam
        );

        // 4. Save or update the record
        const savedGrade = await Grade.findOneAndUpdate(
            { student, subject, term, academicYear },
            {
                test1,
                test2,
                test3,
                assignment,
                exam,
                totalScore,
                grade,
                remark
            },
            { new: true, upsert: true }
        );

        res.status(200).json({
            message: "Scores updated and automatically graded! 🎯",
            result: savedGrade
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ADMIN ONLY: Toggle the grading lock for a term
exports.toggleTermLock = async (req, res) => {
    try {
        const { academicYear, currentTerm, isLocked } = req.body;

        // Validation to ensure correct body data
        if (!academicYear || !currentTerm || typeof isLocked !== 'boolean') {
            return res.status(400).json({ message: "Please provide academicYear, currentTerm, and a boolean isLocked value." });
        }

        // Find the term configuration and update it (create it if it doesn't exist yet)
        const updatedStatus = await TermStatus.findOneAndUpdate(
            { academicYear, currentTerm },
            { isLocked },
            { new: true, upsert: true }
        );

        res.status(200).json({
            message: `Grading system successfully ${isLocked ? 'LOCKED 🔒' : 'UNLOCKED 🔓'} for ${currentTerm} (${academicYear}).`,
            status: updatedStatus
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// STUDENT/DASHBOARD: Fetch complete academic performance profile for a student
exports.getStudentAcademicProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { academicYear } = req.query; // e.g., ?academicYear=2025/2026

        if (!academicYear) {
            return res.status(400).json({ message: "Please provide an academicYear query parameter." });
        }

        // Fetch all grades for this student in the specified academic year
        const rawGrades = await Grade.find({ student: studentId, academicYear })
            .populate('subject', 'subjectName subjectCode section');

        // Organize the data by subject for easy cumulative compiling
        const subjectsReport = {};

        rawGrades.forEach(record => {
            if (!record.subject) return; // Skip if subject data is missing

            const subId = record.subject._id.toString();
            const subName = record.subject.subjectName;
            const subCode = record.subject.subjectCode;
            const section = record.subject.section;

            if (!subjectsReport[subId]) {
                subjectsReport[subId] = {
                    subjectName: subName,
                    subjectCode: subCode,
                    section: section,
                    terms: { firstTerm: null, secondTerm: null, thirdTerm: null },
                    combinedAnnualTotal: 0,
                    termsCount: 0
                };
            }

            // Assign raw score summaries cleanly to their respective terms
            const termKey = record.term === 'First Term' ? 'firstTerm' : 
                            record.term === 'Second Term' ? 'secondTerm' : 'thirdTerm';
            
            subjectsReport[subId].terms[termKey] = {
                totalScore: record.totalScore,
                grade: record.grade,
                remark: record.remark
            };

            // Accumulate totals for the final annual average calculation
            subjectsReport[subId].combinedAnnualTotal += record.totalScore;
            subjectsReport[subId].termsCount += 1;
        });

        // Format final payload data and compute average annual score per subject
        const finalizedSubjects = Object.values(subjectsReport).map(sub => {
            const annualAverage = sub.termsCount > 0 ? Math.round(sub.combinedAnnualTotal / sub.termsCount) : 0;
            
            // Determine their overall grade status based on section
            let annualGrade = 'F';
            if (sub.section === 'SSS') {
                if (annualAverage >= 75) annualGrade = 'A1';
                else if (annualAverage >= 70) annualGrade = 'B2';
                else if (annualAverage >= 65) annualGrade = 'B3';
                else if (annualAverage >= 60) annualGrade = 'C4';
                else if (annualAverage >= 55) annualGrade = 'C5';
                else if (annualAverage >= 50) annualGrade = 'C6';
                else if (annualAverage >= 45) annualGrade = 'D7';
                else if (annualAverage >= 40) annualGrade = 'E8';
                else annualGrade = 'F9';
            } else {
                if (annualAverage >= 70) annualGrade = 'A';
                else if (annualAverage >= 60) annualGrade = 'B';
                else if (annualAverage >= 50) annualGrade = 'C';
                else if (annualAverage >= 40) annualGrade = 'P';
            }

            return {
                subjectName: sub.subjectName,
                subjectCode: sub.subjectCode,
                section: sub.section,
                termBreakdown: sub.terms,
                annualAverage,
                annualGrade
            };
        });

        res.status(200).json({
            studentId,
            academicYear,
            reportCardSummary: finalizedSubjects
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};