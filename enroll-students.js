const axios = require('axios');

// ====================== DATA ======================
const subjects = [
  "6a82f3f4b607293a6d4fa1ac", // Civic Education
  "6a82f3d9b607293a6d4fa1ab", // Social Studies
  "6a82f494b607293a6d4fa1b1", // Cultural and Creative Arts
  "6a82f4eab607293a6d4fa1b2"  // Basic Technology
];

const students = [
  "6ae7cb5b7fdaaa51d9b7da8d", // Adeola Johnson
  "6ae7cc6eeeb93169ac649638", // Chinedu Okoro
  "6ae7cc84eeb93169ac64963a", // Fatima Bello
  "6ae7cca2eeb93169ac64963c", // Ifeanyi Eze
  "6ae7ccc2eeb93169ac64963e"  // Aisha Mohammed
];

// ====================== SCRIPT ======================
async function enrollAll() {
  console.log("Starting enrollment...\n");

  for (const studentId of students) {
    for (const subjectId of subjects) {
      try {
        const res = await axios.post('http://localhost:2000/api/subjects/enroll', {
          subjectId,
          studentId
        });
        console.log(`Enrolled student ${studentId} into subject ${subjectId}`);
      } catch (err) {
        const message = err.response?.data?.message || err.message;
        console.log(`Failed: student ${studentId} → subject ${subjectId} | ${message}`);
      }
    }
  }

  console.log("\nEnrollment process completed!");
}

enrollAll();