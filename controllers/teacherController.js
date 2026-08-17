const Teacher = require('../models/teacherModel');
const bcrypt = require('bcryptjs');

exports.createTeacher = async (req, res) => {
    try {
        const { name, email, password, currentClass, subjects, qualification, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Please provide name, email and password" });
        }

        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(400).json({ message: "Teacher with this email already exists" });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newTeacher = await Teacher.create({
            name,
            email,
            password: hashedPassword,
            currentClass,
            subjects: subjects || [],           // Array of subject IDs
            qualification,
            phone
        });

        res.status(201).json({ 
            message: "Teacher profile created successfully!", 
            teacher: {
                id: newTeacher._id,
                name: newTeacher.name,
                email: newTeacher.email,
                currentClass: newTeacher.currentClass,
                role: 'teacher'
            } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating teacher", error: error.message });
    }
};

exports.getAllTeachers = async (req, res) => {
    try {
        const teachers = await Teacher.find().select('-password');
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};