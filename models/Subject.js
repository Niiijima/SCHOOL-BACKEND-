const mongoose = require('mongoose');

// Define the blueprint for the Subject collection
const subjectSchema = new mongoose.Schema({
    subjectName: { 
        type: String, 
        required: true 
    },
    subjectCode: { 
        type: String, 
        required: true, 
        unique: true 
    },
    // Category to separate Junior (JSS) and Senior (SSS) curriculum
    section: {
        type: String,
        required: true,
        enum: ['JSS', 'SSS'] // Restricts input to only these two options
    },
    // References the Teacher model using its MongoDB ObjectId
    teacher: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Teacher',
        default: null
    },
    // Stores an array of Student ObjectIds enrolled in this subject
    enrolledStudents: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student' 
    }]
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Subject', subjectSchema);