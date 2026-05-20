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

// PIPELINE STEP 2: Input scores, auto-calculate grade totals, add comments, handle manual class size, and save
exports.submitStudentScores = async (req, res) => {
    try {
        const { 
            student, 
            subject, 
            term, 
            academicYear, 
            test1, 
            test2, 
            test3, 
            assignment, 
            exam,
            teacherComment,   
            principalComment,
            noInClass // NEW: Extracted manual class size input typed by the user
        } = req.body;

        // 1. Check if the Admin has locked results for this term
        const termConfig = await TermStatus.findOne({ academicYear, currentTerm: term });
        if (termConfig && termConfig.isLocked) {
            return res.status(403).json({ 
                message: "Access Denied: Results for this term have been locked by the administrator and cannot be modified." 
            });
        }

        // 2. Strict Input Score Cap Validations (Matches O'Lak Triumph PDF Bounds)
        const totalCA = (Number(test1) || 0) + (Number(test2) || 0) + (Number(test3) || 0) + (Number(assignment) || 0);
        if (totalCA > 40) {
            return res.status(400).json({ 
                message: `Validation Error: Cumulative Continuous Assessment (${totalCA}/40) exceeds the maximum allowed limit of 40.` 
            });
        }
        if (exam > 60) {
            return res.status(400).json({ 
                message: `Validation Error: Examination score (${exam}/60) exceeds the maximum allowed limit of 60.` 
            });
        }

        // 3. Fetch the subject to see if it's JSS or SSS
        const subjectDetails = await Subject.findById(subject);
        if (!subjectDetails) {
            return res.status(404).json({ message: "Subject not found." });
        }

        // 4. Compute the grading metrics automatically using our utility engine
        const { totalScore, grade, remark } = calculateGrade(
            subjectDetails.section,
            test1,
            test2,
            test3,
            assignment,
            exam
        );

        // 5. Save or update the record including comment properties and manual class size
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
                remark,
                teacherComment: teacherComment || "",     
                principalComment: principalComment || "",   
                manualNoInClass: noInClass !== undefined && noInClass !== "" ? Number(noInClass) : null // Saves what they typed!
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

// ADMIN ONLY: Toggle the grading lock for a term and set resumption rules
exports.toggleTermLock = async (req, res) => {
    try {
        const { academicYear, currentTerm, isLocked, nextTermBegins } = req.body;

        // Validation to ensure correct body data
        if (!academicYear || !currentTerm || typeof isLocked !== 'boolean') {
            return res.status(400).json({ message: "Please provide academicYear, currentTerm, and a boolean isLocked value." });
        }

        // Find the term configuration and update it (create it if it doesn't exist yet)
        const updatedStatus = await TermStatus.findOneAndUpdate(
            { academicYear, currentTerm },
            { isLocked, nextTermBegins: nextTermBegins || "" },
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
                test1: record.test1,
                test2: record.test2,
                test3: record.test3,
                assignment: record.assignment,
                exam: record.exam,
                totalScore: record.totalScore,
                grade: record.grade,
                remark: record.remark,
                teacherComment: record.teacherComment || "",     
                principalComment: record.principalComment || ""   
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
                if (annualAverage >= 70) annualGrade = 'A'; 
                else if (annualAverage >= 60) annualGrade = 'B';
                else if (annualAverage >= 50) annualGrade = 'C';
                else if (annualAverage >= 45) annualGrade = 'D';
                else if (annualAverage >= 40) annualGrade = 'E';
                else annualGrade = 'F';
            } else {
                if (annualAverage >= 70) annualGrade = 'A';
                else if (annualAverage >= 60) annualGrade = 'B';
                else if (annualAverage >= 50) annualGrade = 'C';
                else if (annualAverage >= 40) annualGrade = 'P';
            }

            return {
                subjectName: sub.subjectName,
                subjectCode: subCode,
                section: sub.section,
                termBreakdown: sub.terms,
                annualAverage,
                annualGrade
            };
        });

        // Pull down global administrative metadata for this school term session
        const activeTermMeta = await TermStatus.findOne({ academicYear, currentTerm: 'Second Term' }) 
            || await TermStatus.findOne({ academicYear });

        // NEW: Scan student records to see if a custom class count was manually entered
        const manualClassSizeRecord = rawGrades.find(record => record.manualNoInClass !== null);
        const displayNoInClass = manualClassSizeRecord ? manualClassSizeRecord.manualNoInClass : "Not Specified";

        res.status(200).json({
            studentId,
            academicYear,
            nextTermBegins: activeTermMeta ? activeTermMeta.nextTermBegins : "To Be Determined", 
            noInClass: displayNoInClass, // Returns manual number if typed, else "Not Specified"
            reportCardSummary: finalizedSubjects
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// HELPER PIPELINE: Calculate Class Position and Total Strength (Prioritizes Manual Class Input Override)
exports.getClassPerformanceMetrics = async (req, res) => {
    try {
        const { targetClass, academicYear, term } = req.query; 

        if (!targetClass || !academicYear || !term) {
            return res.status(400).json({ message: "Missing required query parameters: targetClass, academicYear, term" });
        }

        // 1. Fetch all grades matching this term and year
        const totalGrades = await Grade.find({ academicYear, term })
            .populate({
                path: 'student',
                select: 'name currentClass' 
            });

        // 2. Filter grades to only include students in our target class arm
        const classGrades = totalGrades.filter(g => g.student && g.student.currentClass === targetClass);

        // 3. Group raw scores by individual student to find their cumulative totals
        let manualClassOverride = null;
        const studentTotals = {};
        
        classGrades.forEach(g => {
            // Check if any grade row has a saved custom typed class count
            if (g.manualNoInClass !== null) {
                manualClassOverride = g.manualNoInClass;
            }

            const sId = g.student._id.toString();
            if (!studentTotals[sId]) {
                studentTotals[sId] = {
                    studentId: sId,
                    name: g.student.name,
                    accumulatedScore: 0,
                    subjectsCount: 0
                };
            }
            studentTotals[sId].accumulatedScore += g.totalScore;
            studentTotals[sId].subjectsCount += 1;
        });

        // 4. Calculate individual averages and sort descending to establish rank/position
        const rankedStudents = Object.values(studentTotals).map(student => {
            const average = student.subjectsCount > 0 ? (student.accumulatedScore / student.subjectsCount) : 0;
            return {
                ...student,
                percentageAggregate: Number(average.toFixed(2))
            };
        }).sort((a, b) => b.percentageAggregate - a.percentageAggregate);

        // 5. Total Number in Class: Prefer user input value, fall back to auto-calculated list length
        const totalInClass = manualClassOverride !== null ? manualClassOverride : rankedStudents.length;

        res.status(200).json({
            targetClass,
            academicYear,
            term,
            noInClass: totalInClass, // Now displays what the user typed or edits!
            rankings: rankedStudents 
        });

    } catch (error) {
        res.status(500).json({ message: "Server error during metrics compilation", error: error.message });
    }
};