const mongoose = require('mongoose');
const { ALLOWED_CLASSES, DEPARTMENTS } = require('../utils/allowedClasses');

const studentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'A student profile must belong to a registered user account.']
  },

  name: { 
    type: String, 
    required: [true, 'Please provide the student name'],
    trim: true
  },

  admissionNumber: {
    type: String,
    required: [true, 'Please provide an admission number'],
    unique: true,
    trim: true
  },

  currentClass: {
    type: String,
    required: [true, 'Please assign a class'],
    trim: true,
    enum: {
      values: ALLOWED_CLASSES,
      message: `Class must be one of: ${ALLOWED_CLASSES.join(', ')}`
    }
  },

  // Only for SS1, SS2, SS3
  department: {
    type: String,
    enum: {
      values: DEPARTMENTS,           // ← no null here
      message: `Department must be one of: ${DEPARTMENTS.join(', ')}`
    },
    default: null                   // still allows null
  },

  gender: {
    type: String,
    enum: ['Male', 'Female'],
    required: [true, 'Please provide gender']
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

// Virtual property to display class with department for senior classes
studentSchema.virtual('displayClass').get(function () {
  if (this.department && ['SS1', 'SS2', 'SS3'].includes(this.currentClass)) {
    return `${this.currentClass} ${this.department}`;
  }
  return this.currentClass;
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);