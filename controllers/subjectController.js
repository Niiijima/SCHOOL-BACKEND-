const Subject = require('../models/Subject');
const Student = require('../models/Student');


// Create a brand new subject in the curriculum
exports.createSubject = async (req, res) => {
  try {
    const { name, code, subjectName, subjectCode, section, className } = req.body;

    const cleanName = String(subjectName || name || "").trim();
    const cleanCode = String(subjectCode || code || "").trim().toUpperCase();

    // Decide section from body or from className
    let cleanSection = String(section || "").trim().toUpperCase();
    if (!cleanSection && className) {
      const cls = String(className).trim().toUpperCase();
      cleanSection = ["SS1", "SS2", "SS3"].includes(cls) ? "SSS" : "JSS";
    }
    if (!cleanSection) cleanSection = "JSS";

    if (!cleanName || !cleanCode) {
      return res.status(400).json({
        message: "Subject name and code are required",
      });
    }

    const subject = await Subject.create({
      subjectName: cleanName,
      subjectCode: cleanCode,
      section: cleanSection,
    });

    return res.status(201).json({
      message: "Subject created successfully",
      subject,
    });
  } catch (err) {
    console.error("createSubject error:", err);
    return res.status(500).json({
      message: err.message || "Failed to create subject",
    });
  }
};

// Retrieve all subjects in the school
exports.getAllSubjects = async (req, res) => {
    try {
        const subjects = await Subject.find()
            .populate('teacher', 'name email') // Pulls in teacher details when we build teachers
            .populate('enrolledStudents', 'name email phone'); // Pulls in registered student details

        res.status(200).json(subjects);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
exports.enrollStudent = async (req, res) => {
    try {
        const { subjectCode, admissionNumber, subjectId, studentId } = req.body;

        // Find Subject
        let subject;
        if (subjectCode) {
            subject = await Subject.findOne({ subjectCode: subjectCode.toUpperCase() });
        } else if (subjectId) {
            subject = await Subject.findById(subjectId);
        }

        if (!subject) {
            return res.status(404).json({ message: "Subject not found" });
        }

        // Find Student
        let student;
        if (admissionNumber) {
            student = await Student.findOne({ admissionNumber });
        } else if (studentId) {
            student = await Student.findById(studentId);
        }

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Check if already enrolled
        if (subject.enrolledStudents.includes(student._id)) {
            return res.status(400).json({ message: "Student is already enrolled in this subject" });
        }

        // Enroll
        subject.enrolledStudents.push(student._id);
        await subject.save();

        res.status(200).json({
            message: "Student enrolled successfully",
            subject: {
                subjectName: subject.subjectName,
                subjectCode: subject.subjectCode,
                enrolledCount: subject.enrolledStudents.length
            },
            student: {
                name: student.name,
                admissionNumber: student.admissionNumber
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

//create subjects in bulk for multiple classes
exports.createSubjectBulk = async (req, res) => {
  try {
    const { name, code, subjectName, subjectCode, sections } = req.body;

    const cleanName = String(subjectName || name || "").trim();
    const cleanCode = String(subjectCode || code || "").trim().toUpperCase();

    // Default: junior section only
    const targetSections =
      Array.isArray(sections) && sections.length
        ? sections.map((s) => String(s).trim().toUpperCase())
        : ["JSS"];

    if (!cleanName || !cleanCode) {
      return res.status(400).json({
        message: "Subject name and code are required",
      });
    }

    const created = [];
    const skipped = [];

    for (const section of targetSections) {
      const existing = await Subject.findOne({
        subjectCode: cleanCode,
        section,
      });

      if (existing) {
        skipped.push(section);
        continue;
      }

      const subject = await Subject.create({
        subjectName: cleanName,
        subjectCode: cleanCode,
        section,
      });
      created.push(subject);
    }

    return res.status(201).json({
      message: `Created for ${created.length} section(s)${
        skipped.length ? `; skipped: ${skipped.join(", ")}` : ""
      }`,
      subjects: created,
      skipped,
    });
  } catch (err) {
    console.error("createSubjectBulk error:", err);
    return res.status(500).json({
      message: err.message || "Failed to create subjects",
    });
  }
};