const mongoose = require('mongoose');

const resultLockSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    term: {
      type: String,
      enum: ['First Term', 'Second Term', 'Third Term'],
      required: true,
    },
    isLocked: {
      type: Boolean,
      default: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// One lock record per student + year + term
resultLockSchema.index(
  { student: 1, academicYear: 1, term: 1 },
  { unique: true }
);

module.exports = mongoose.model('ResultLock', resultLockSchema);