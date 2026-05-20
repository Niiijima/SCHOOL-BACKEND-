const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    term: {
        type: String,
        required: true,
        enum: ['First Term', 'Second Term', 'Third Term']
    },
    academicYear: {
        type: String, // e.g., "2025/2026"
        required: true
    },
    // Granular continuous assessment tracking
    test1: { type: Number, default: 0, min: 0, max: 10 },       // out of 10
    test2: { type: Number, default: 0, min: 0, max: 10 },       // out of 10
    test3: { type: Number, default: 0, min: 0, max: 10 },       // out of 10
    assignment: { type: Number, default: 0, min: 0, max: 10 },  // out of 10
    exam: { type: Number, default: 0, min: 0, max: 60 },        // out of 60

    // System-generated totals and outcomes
    totalScore: { type: Number },
    grade: { type: String },
    remark: { type: String },

    // Report Card Comments matching the provided template
    teacherComment: { 
        type: String, 
        default: "" // e.g., "There is room for improvement"
    },
    principalComment: { 
        type: String, 
        default: "" // e.g., "Work harder."
    },

    // NEW OVERRIDE: Allows a teacher or admin to manually type and edit the class count
    manualNoInClass: {
        type: Number,
        default: null,
        min: 0
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Grade', gradeSchema);