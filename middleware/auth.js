
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Admin = require('../models/adminModel');
const User = require('../models/User');
const Student = require('../models/Student');

// ====================== PROTECT ======================

exports.protect = async (req, res, next) => {
    try {
        let token;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer ')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                message: 'You are not logged in. Please log in to get access.'
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: 'JWT secret is not configured.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
            return res.status(401).json({
                message: 'Invalid authentication token.'
            });
        }

        // 1. Check Admin collection
        let currentUser = await Admin.findById(decoded.id).select('-password');

        if (currentUser) {
            req.user = {
                id: currentUser._id.toString(),
                role: currentUser.role || 'admin',
                name: currentUser.name,
                email: currentUser.email
            };

            return next();
        }

        // 2. Check User collection
        currentUser = await User.findById(decoded.id).select('-password');

        if (!currentUser) {
            return res.status(401).json({
                message: 'The user belonging to this token no longer exists.'
            });
        }

        if (currentUser.isActive === false) {
            return res.status(401).json({
                message: 'This account has been deactivated.'
            });
        }

        const dbRole = currentUser.role;

        req.user = {
            id: currentUser._id.toString(),
            role: dbRole,
            name: currentUser.name,
            email: currentUser.email
        };

        // 3. Attach student profile where applicable
        if (dbRole === 'student') {
            const student = await Student.findOne({
                user: currentUser._id
            });

            if (student) {
                req.user.studentProfile = student._id.toString();
            }
        }

        return next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Invalid or expired token.'
            });
        }

        console.error('Authentication error:', error);

        return res.status(500).json({
            message: 'Authentication failed due to a server error.'
        });
    }
};

// ====================== RESTRICT TO ======================

exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                message: 'Authentication required. Please log in.'
            });
        }

        const userRole = String(req.user.role).toLowerCase();

        const permittedRoles = allowedRoles.map(role =>
            String(role).toLowerCase()
        );

        if (!permittedRoles.includes(userRole)) {
            return res.status(403).json({
                message: `Forbidden: Your role (${userRole}) does not have permission.`
            });
        }

        return next();
    };
};
