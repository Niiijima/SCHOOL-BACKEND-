
const mongoose = require("mongoose");
const {
  ALLOWED_CLASSES,
  DEPARTMENTS,
} = require("../utils/allowedClasses");

const requiresDepartment = (className = "") => {
  return ["SS2", "SS3"].includes(
    String(className).trim().toUpperCase()
  );
};

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [
        true,
        "A student profile must belong to a registered user account.",
      ],
    },

    firstName: {
      type: String,
      required: [true, "Please provide the student's first name"],
      trim: true,
    },

    surname: {
      type: String,
      required: [true, "Please provide the student's surname"],
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
      uppercase: true,
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
      required: [
        function () {
          return requiresDepartment(this.currentClass);
        },
        "A department is required for SS2 and SS3 students.",
      ],
      default: undefined,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: [true, "Please provide the student's gender"],
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

// Keep a full-name virtual for existing code that reads student.name.
studentSchema.virtual("name").get(function () {
  return `${this.firstName || ""} ${this.surname || ""}`.trim();
});

studentSchema.virtual("displayClass").get(function () {
  if (requiresDepartment(this.currentClass) && this.department) {
    return `${this.currentClass} ${this.department}`;
  }

  return this.currentClass;
});

// Remove departments from JSS1-JSS3 and SS1.
studentSchema.pre("validate", function () {
  if (!requiresDepartment(this.currentClass)) {
    this.department = undefined;
  }
});

module.exports = mongoose.model("Student", studentSchema);
