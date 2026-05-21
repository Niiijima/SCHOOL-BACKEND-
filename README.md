School Management Backend API
This is a robust Node.js backend built for a School Management System. It handles student grading, subject management, and termly academic reporting with built-in security and role-based access control.

🚀 Key Features
Grading Pipeline: Automated grade calculation with support for multiple terms.

Security & Auth: JWT-based authentication with role-based access control (Admin, Teacher, Student).

Data Integrity: Term locking mechanism to prevent unauthorized changes after grading.

Automated Reporting: Generates annual academic profiles, including performance remarks and tutor/admin comments.

🛠️ Tech Stack
Node.js & Express

MongoDB & Mongoose

JSON Web Tokens (JWT) for security
📋 API EndpointsMethodEndpointDescriptionAuth RequiredPOST/api/grades/submit-scoresCreate/Update student scoresTeacher
GET/api/grades/student/:studentIdFetch academic profile & annual reportAll
GET/api/grades/subject/:subjectId/studentsGet student list by subjectTeacher, Admin
PATCH/api/grades/admin/toggle-lockLock/Unlock term resultsAdmin
GET/api/grades/class-metricsFetch class performance dataAdmin, Teacher


How to Setup
Clone the repository:
Bash
git clone https://github.com/Niiijima/SCHOOL-BACKEND-

Install dependencies:
Bash
npm install

Configure Environment Variables:
Create a .env file in the root directory and add:
Code snippet
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key

Start the Server:
Bash
npm start


Data Structure Overview
The system relies on a relational-like structure using MongoDB references.

📝 Testing Strategy
To verify the system, follow the Submit-Verify pattern:

Submit scores for First, Second, and Third Term using POST /submit-scores.

Ensure you use the same student, subject, and academicYear.

Call the GET /student/:studentId/academic-profile endpoint to see the aggregated Annual Report and automated comments.

🛡️ Security Notes
IDOR Protection: The student profile endpoint automatically restricts students to view only their own record via req.user.studentProfile.

Term Locks: The submit-scores endpoint checks the TermStatus collection before writing any data to the database.
