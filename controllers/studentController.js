const Student = require('../models/Student');
const cloudinary = require('cloudinary').v2; 

// Register a brand new student profile
exports.registerStudent = async (req, res) => {
    try {
        const { name, email, phone } = req.body;

        // Prevent duplicate accounts by checking the unique email address
        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
            return res.status(400).json({ message: "Student already registered." });
        }

        // Extract the secure hosting URL if Multer intercepted an uploaded image file
        let imageUrl = "";
        if (req.file) {
            imageUrl = req.file.path; 
        }

        // Instantiate the new document layout with the captured text and media data
        const newStudent = new Student({
            name,
            email,
            phone, 
            profileImage: imageUrl 
        });

        // Persist the record into MongoDB Atlas
        await newStudent.save();

        res.status(201).json({
            message: "Student registered successfully! 🎓",
            student: newStudent
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Retrieve a full roster list of all registered students
exports.getAllStudents = async (req, res) => {
    try {
        const students = await Student.find();
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Retrieve a specific student profile using their unique database ID
exports.getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        res.status(200).json(student);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update existing records, phone numbers, status flags, or profile images dynamically
exports.updateStudent = async (req, res) => {
    try {
        const { name, email, phone, enrollmentStatus } = req.body;
        
        // Ensure the target student exists before performing modifications
        let student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Only overwrite fields that were explicitly sent in the request body
        if (name) student.name = name;
        if (email) student.email = email;
        if (phone) student.phone = phone;
        if (enrollmentStatus) student.enrollmentStatus = enrollmentStatus;

        // Overwrite the existing image URL if a brand new file payload is submitted
        if (req.file) {
            student.profileImage = req.file.path; 
        }

        // Save modifications back to the database
        await student.save();

        res.status(200).json({
            message: "Student profile updated successfully! 📝",
            student
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Permanently drop a student profile from the database and wipe their Cloudinary assets
exports.deleteStudent = async (req, res) => {
    try {
        // Find the target record to locate the associated media asset URL
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Extract the unique Cloudinary public ID from the image URL path string to handle storage cleanup
        if (student.profileImage) {
            const urlParts = student.profileImage.split('/');
            const fileNameWithExtension = urlParts[urlParts.length - 1];
            const publicId = `school_backend_students/${fileNameWithExtension.split('.')[0]}`;
            
            // Delete the raw media asset resource directly from the remote Cloudinary bucket
            await cloudinary.uploader.destroy(publicId);
        }

        // Remove the data record text entry completely from MongoDB collection
        await Student.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Student profile and assets deleted successfully! 🗑️"
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};