const mongoose = require('mongoose');

const termStatusSchema = new mongoose.Schema({
    academicYear: { 
        type: String, 
        required: true,
        unique: true // Ensures only one setup doc exists per session year (e.g., "2025/2026")
    },
    currentTerm: { 
        type: String, 
        required: true, 
        enum: ['First Term', 'Second Term', 'Third Term'] 
    },
    isLocked: { 
        type: Boolean, 
        default: false // By default, teachers can edit until Admin locks it
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('TermStatus', termStatusSchema);