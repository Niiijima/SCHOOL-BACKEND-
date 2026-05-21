const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Use bcryptjs as requested in your snippet

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false // Automatically hides password when fetching users
    },
    role: {
        type: String,
        enum: ['admin', 'teacher', 'student'],
        default: 'student'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // The bridge to your Student model
    studentProfile: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student' 
    }
}, {
    timestamps: true
});

// Middleware: Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method: Verify password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', userSchema);