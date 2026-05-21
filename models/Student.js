const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  // Link to the core login account
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'A student profile must belong to a registered user account.']
  },
  name: { 
    type: String, 
    required: [true, 'Please provide the student name'] 
  },
  admissionNumber: {
    type: String,
    required: [true, 'Please provide an admission number'],
    unique: true,
    trim: true
  },
  currentClass: {
    type: String,
    required: [true, 'Please assign a class arm (e.g., SSS 1 A, JSS 3 B)'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female'],
    required: true
  },
  dateOfBirth: { type: Date },
  guardianName: { type: String, trim: true },
  guardianPhone: { type: String, trim: true },
  status: { 
    type: String, 
    enum: ['active', 'graduated', 'withdrawn'], 
    default: 'active' 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Student', studentSchema);