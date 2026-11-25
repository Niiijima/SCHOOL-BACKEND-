
require('dotenv').config();

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Import application routes
const studentRoutes = require('./routes/studentRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacherRoutes');

// MongoDB connection
const uri = process.env.MONGO_URI;

mongoose
  .connect(uri)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Connect Cloudinary
require('./config/cloudinary');

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'https://school-s-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());

// API routes
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/grades', require('./routes/gradeRoutes'));
app.use('/api/admin', adminRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/settings', require('./routes/settingsRoutes'));

// Multer middleware
const upload = require('./config/multer');

// Temporary test upload route
app.post('/api/test-upload', (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err) {
      console.error('MULTER-CLOUDINARY PIPELINE ERROR:', err);

      return res.status(500).json({
        message: 'Pipeline Error encountered',
        errorDetails: err.message || err.toString()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded!'
      });
    }

    res.status(200).json({
      message: 'Upload successful!',
      imageUrl: req.file.path
    });
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('Hello world');
});

// Start server
const port = process.env.PORT || 2000;

app.listen(port, () => {
  console.log(`School server is running on port ${port}`);
});
