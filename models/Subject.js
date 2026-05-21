const mongoose = require('mongoose');

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
    section: {
        type: String,
        required: true,
        enum: ['JSS', 'SSS'] 
    },
    // CHANGED: Points to 'User' since teachers live in the User collection
    teacher: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null
    },
    enrolledStudents: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student' 
    }]
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Subject', subjectSchema);