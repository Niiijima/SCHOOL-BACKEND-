const mongoose = require('mongoose');

const termStatusSchema = new mongoose.Schema({
    academicYear: { 
        type: String, 
        required: true
        // Removed unique: true from here to prevent duplicate errors across terms
    },
    currentTerm: { 
        type: String, 
        required: true, 
        enum: ['First Term', 'Second Term', 'Third Term'] 
    },
    isLocked: { 
        type: Boolean, 
        default: false // By default, teachers can edit until Admin locks it
    },
    // NEW: Pushes the resumption date directly into the printable header
    nextTermBegins: {
        type: String,
        default: "" // e.g., "5/4/2026"
    }
}, { 
    timestamps: true 
});

// FIX: This creates a compound unique constraint. 
// It allows "2025/2026" + "First Term" AND "2025/2026" + "Second Term" safely!
termStatusSchema.index({ academicYear: 1, currentTerm: 1 }, { unique: true });

module.exports = mongoose.model('TermStatus', termStatusSchema);