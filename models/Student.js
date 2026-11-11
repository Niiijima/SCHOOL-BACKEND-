const mongoose = require("mongoose");
const {
  ALLOWED_CLASSES,
  DEPARTMENTS,
} = require("../utils/allowedClasses");

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A student profile must belong to a registered user account."],
    },
    name: {
      type: String,
      required: [true, "Please provide the student name"],
      trim: true,
    },
    admissionNumber: {
      type: String,
      required: [true, "Please provide an admission number"],
      unique: true,
      trim: true,
    },
    currentClass: {
      type: String,
      required: [true, "Please assign a class"],
      trim: true,
      enum: {
        values: ALLOWED_CLASSES,
        message: `Class must be one of: ${ALLOWED_CLASSES.join(", ")}`,
      },
    },
    department: {
      type: String,
      enum: {
        values: DEPARTMENTS,
        message: `Department must be one of: ${DEPARTMENTS.join(", ")}`,
      },
      default: undefined, // null/undefined for junior classes
    },
    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    guardianName: {
      type: String,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "graduated", "withdrawn"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for nice display (e.g. "SS1 Science" or "JSS2")
studentSchema.virtual("displayClass").get(function () {
  if (this.department) {
    return `${this.currentClass} ${this.department}`;
  }
  return this.currentClass;
});

module.exports = mongoose.model("Student", studentSchema);