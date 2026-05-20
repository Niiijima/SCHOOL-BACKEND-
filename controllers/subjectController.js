const Subject = require('../models/Subject');

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
            message: "Subject created successfully! 📚",
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