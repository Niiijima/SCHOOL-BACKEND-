const Teacher = require('../models/teacherModel'); 

exports.createTeacher = async (req, res) => {
    try {
        const { name, email, password, subjectIds } = req.body;
        const newTeacher = new Teacher({ name, email, password, subjects: subjectIds });
        await newTeacher.save();
        res.status(201).json({ message: "Teacher profile created successfully", teacher: newTeacher });
    } catch (error) {
        res.status(500).json({ message: "Error creating teacher", error: error.message });
    }
};