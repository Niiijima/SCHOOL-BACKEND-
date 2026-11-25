
const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
        },

        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            required: true,
        },

        term: {
            type: String,
            required: true,
            enum: ['First Term', 'Second Term', 'Third Term'],
        },

        academicYear: {
            type: String,
            required: true,
        },

        // ==========================================
        // CONTINUOUS ASSESSMENT — NEW STRUCTURE
        // ==========================================

        test1: {
            type: Number,
            default: null,
            min: 0,
            max: 10,
        },

        test2: {
            type: Number,
            default: null,
            min: 0,
            max: 20,
        },

        notes: {
            type: Number,
            default: null,
            min: 0,
            max: 5,
        },

        oral: {
            type: Number,
            default: null,
            min: 0,
            max: 5,
        },

        // ==========================================
        // LEGACY CA FIELDS
        // Keep these for old records and compatibility
        // ==========================================

        test3: {
            type: Number,
            default: 0,
            min: 0,
            max: 10,
        },

        assignment: {
            type: Number,
            default: 0,
            min: 0,
            max: 10,
        },

        // ==========================================
        // EXAMINATION
        // ==========================================

        exam: {
            type: Number,
            default: null,
            min: 0,
            max: 60,
        },

        // ==========================================
        // SUBMISSION STATUS
        // ==========================================

        caSubmitted: {
            type: Boolean,
            default: false,
        },

        examSubmitted: {
            type: Boolean,
            default: false,
        },

        // ==========================================
        // CALCULATED RESULT
        // These remain empty until CA and Exam exist
        // ==========================================

        totalScore: {
            type: Number,
            default: null,
            min: 0,
            max: 100,
        },

        grade: {
            type: String,
            default: null,
        },

        remark: {
            type: String,
            default: null,
        },

        teacherComment: {
            type: String,
            default: '',
        },

        principalComment: {
            type: String,
            default: '',
        },

        manualNoInClass: {
            type: Number,
            default: null,
            min: 0,
        },

        gradedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// One record per student, subject, term and academic year.
gradeSchema.index(
    {
        student: 1,
        subject: 1,
        term: 1,
        academicYear: 1,
    },
    {
        unique: true,
    }
);

module.exports = mongoose.model('Grade', gradeSchema);
