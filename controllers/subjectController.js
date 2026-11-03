const Subject = require('../models/Subject');
const Student = require('../models/Student');

// Create a brand new subject in the curriculum
exports.createSubject = async (req, res) => {
    try {
        const { subjectName, subjectCode, section } = req.body;

        // Validation for section input
        if (!section || !['JSS', 'SSS'].includes(section.toUpperCase())) {
            return res.status(400).json({ message: "Section must be either 'JSS' or 'SSS'." });
        }

        // Prevent duplicate subjects using the unique subject code
        const existingSubject = await Subject.findOne({ subjectCode });
        if (existingSubject) {
            return res.status(400).json({ message: "Subject code already exists." });
        }

        const newSubject = new Subject({
            subjectName,
            subjectCode,
            section: section.toUpperCase() // Saves as uniform uppercase
        });

        await newSubject.save();

        res.status(201).json({
            message: "Subject created successfully!",
            subject: newSubject
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Retrieve all subjects in the school
exports.getAllSubjects = async (req, res) => {
    try {
        const subjects = await Subject.find()
            .populate('teacher', 'name email') // Pulls in teacher details when we build teachers
            .populate('enrolledStudents', 'name email phone'); // Pulls in registered student details

        res.status(200).json(subjects);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
exports.enrollStudent = async (req, res) => {
    try {
        const { subjectCode, admissionNumber, subjectId, studentId } = req.body;

        // Find Subject
        let subject;
        if (subjectCode) {
            subject = await Subject.findOne({ subjectCode: subjectCode.toUpperCase() });
        } else if (subjectId) {
            subject = await Subject.findById(subjectId);
        }

        if (!subject) {
            return res.status(404).json({ message: "Subject not found" });
        }

        // Find Student
        let student;
        if (admissionNumber) {
            student = await Student.findOne({ admissionNumber });
        } else if (studentId) {
            student = await Student.findById(studentId);
        }

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Check if already enrolled
        if (subject.enrolledStudents.includes(student._id)) {
            return res.status(400).json({ message: "Student is already enrolled in this subject" });
        }

        // Enroll
        subject.enrolledStudents.push(student._id);
        await subject.save();

        res.status(200).json({
            message: "Student enrolled successfully",
            subject: {
                subjectName: subject.subjectName,
                subjectCode: subject.subjectCode,
                enrolledCount: subject.enrolledStudents.length
            },
            student: {
                name: student.name,
                admissionNumber: student.admissionNumber
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};