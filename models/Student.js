const mongoose = require('mongoose');
const studentSchema = new mongoose.Schema({
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
    required: [true, 'Please assign a class arm'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female'],
    required: true
  },
  dateOfBirth: { 
    type: Date 
  },
  address: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  guardianName: { 
    type: String, 
    trim: true 
  },
  guardianPhone: { 
    type: String, 
    trim: true 
  },
  profileImage: {
    type: String,
    default: ""
  },
  status: { 
    type: String, 
    enum: ['active', 'graduated', 'withdrawn'], 
    default: 'active' 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Student', studentSchema);