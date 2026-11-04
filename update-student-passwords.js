const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Student = require('./models/Student');

async function updatePasswords() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully");

        const students = await Student.find();
        console.log(`Found ${students.length} students`);

        for (const student of students) {
            console.log(`Processing: ${student.name}`);

            if (!student.user) {
                console.log(`  → Skipped (no linked user)`);
                continue;
            }

            const nameParts = student.name.trim().split(' ');
            const surname = nameParts[nameParts.length - 1].toLowerCase();

            const hashedPassword = await bcrypt.hash(surname, 12);

            await User.findByIdAndUpdate(student.user, {
                password: hashedPassword
            });

            console.log(`  → Password updated to: ${surname}`);
        }

        console.log("\nDone! All passwords updated.");
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

updatePasswords();