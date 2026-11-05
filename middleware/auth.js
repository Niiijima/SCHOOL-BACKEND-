const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');
const User = require('../models/User');
const Student = require('../models/Student');

// ====================== PROTECT ======================
exports.protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ 
                message: "You are not logged in. Please log in to get access." 
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: "JWT secret is not configured" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let currentUser = null;

        // 1. Try Admin collection first
        currentUser = await Admin.findById(decoded.id);
        if (currentUser) {
            req.user = {
                id: currentUser._id,
                role: currentUser.role || 'admin',
                name: currentUser.name,
                email: currentUser.email
            };
            return next();
        }

        // 2. Try User collection (students / teachers)
        currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({ 
                message: "The user belonging to this token no longer exists." 
            });
        }

        // Check if account is active
        if (currentUser.isActive === false) {
            return res.status(401).json({ message: "This account has been deactivated." });
        }

        // Verify role from database (not just from token)
        const dbRole = currentUser.role;

        req.user = {
            id: currentUser._id,
            role: dbRole,
            name: currentUser.name,
            email: currentUser.email
        };

        // If student, attach studentProfile
        if (dbRole === 'student') {
            const student = await Student.findOne({ user: currentUser._id });
            if (student) {
                req.user.studentProfile = student._id;
            }
        }

        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
};

// ====================== RESTRICT TO ======================
exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ 
                message: "Authentication required. Please log in." 
            });
        }

        if (!allowedRoles.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({ 
                message: `Forbidden: Your role (${req.user.role}) does not have permission.` 
            });
        }

        next();
    };
};