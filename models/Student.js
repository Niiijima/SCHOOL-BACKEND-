const mongoose = require('mongoose');

// Define the blueprint for the Student collection in MongoDB
const StudentSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    phone: { 
        type: String, 
        required: true 
    },
    profileImage: { 
        type: String, 
        default: "" 
    },
    // Restrict status to specific allowed choices with a default fallback
    enrollmentStatus: { 
        type: String, 
        enum: ['Active', 'Inactive', 'Suspended', 'Graduated'], 
        default: 'Active' 
    }
}, { 
    // Automatically manages createdAt and updatedAt fields for tracking registrations
    timestamps: true 
});

module.exports = mongoose.model('Student', StudentSchema);