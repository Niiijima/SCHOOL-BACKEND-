const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    qualification: String,
    
    // Class Teacher specific
    currentClass: { type: String },        
    
    // Subjects they can grade / teach
    subjects: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject' 
    }],
    
    role: { 
        type: String, 
        default: 'teacher' 
    },
    status: { 
        type: String, 
        enum: ['active', 'inactive'], 
        default: 'active' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);