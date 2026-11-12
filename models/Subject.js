
const mongoose = require('mongoose');

const ALLOWED_CLASSES = [
    'JSS1',
    'JSS2',
    'JSS3',
    'SS1',
    'SS2',
    'SS3'
];

const ALLOWED_DEPARTMENTS = [
    'Science',
    'Arts',
    'Commercial'
];

const requiresDepartment = (className) => {
    return ['SS2', 'SS3'].includes(
        String(className || '').trim().toUpperCase()
    );
};

const classAssignmentSchema = new mongoose.Schema(
    {
        className: {
            type: String,
            required: true,
            enum: ALLOWED_CLASSES
        },
        department: {
            type: String,
            enum: ALLOWED_DEPARTMENTS,
            default: null,
            validate: {
                validator: function (department) {
                    if (requiresDepartment(this.className)) {
                        return Boolean(department);
                    }

                    return department == null;
                },
                message: function () {
                    return requiresDepartment(this.className)
                        ? 'A department is required for SS2 and SS3 subject assignments.'
                        : 'JSS1-JSS3 and SS1 subject assignments must not have a department.';
                }
            }
        }
    },
    { _id: false }
);

const subjectSchema = new mongoose.Schema(
    {
        subjectName: {
            type: String,
            required: true,
            trim: true
        },

        subjectCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        section: {
            type: String,
            required: true,
            enum: ['JSS', 'SSS']
        },

        classAssignments: {
            type: [classAssignmentSchema],
            default: []
        },

        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        enrolledStudents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Student'
            }
        ],

        // Students individually excluded from this subject.
        excludedStudents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Student'
            }
        ]
    },
    { timestamps: true }
);

subjectSchema.pre('validate', function () {
    this.classAssignments.forEach((assignment) => {
        if (!requiresDepartment(assignment.className)) {
            assignment.department = null;
        }
    });
});

module.exports = mongoose.model('Subject', subjectSchema);
