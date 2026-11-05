const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    currentAcademicYear: {
        type: String,
        required: true,
        default: "2025/2026"
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);