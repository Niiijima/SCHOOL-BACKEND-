
const mongoose = require('mongoose');

const termStatusSchema = new mongoose.Schema({
    academicYear: {
        type: String,
        required: true
    },

    currentTerm: {
        type: String,
        required: true,
        enum: ['First Term', 'Second Term', 'Third Term']
    },

    isLocked: {
        type: Boolean,
        default: false
    },

    isPublished: {
        type: Boolean,
        default: false
    },

    nextTermBegins: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

termStatusSchema.index(
    { academicYear: 1, currentTerm: 1 },
    { unique: true }
);

module.exports = mongoose.model('TermStatus', termStatusSchema);
