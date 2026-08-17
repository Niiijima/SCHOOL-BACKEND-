const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

// 1. Unified Middleware to protect routes
exports.protect = async (req, res, next) => {
    console.log("Header received by server:", req.headers.authorization); 

    try {
        let token;
        // 1. Check for token
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: "You are not logged in. Please log in to get access." });
        }

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Check if user still exists
        const currentUser = await Admin.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({ message: "The user belonging to this token no longer exists." });
        }

        // 4. Grant access
        req.user = currentUser;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
};

// 2. Middleware to restrict access based on roles
exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: "Authentication required: Please log in." });
        }

        if (!allowedRoles.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({ 
                message: `Forbidden: Your role (${req.user.role}) does not have permission to access this resource.` 
            });
        }
        next();
    };
};
exports.protect = async (req, res, next) => {
    console.log("--- DEBUGGING PROTECT ---");
    console.log("Auth Header:", req.headers.authorization);

    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            console.log("Result: No token found");
            return res.status(401).json({ message: "You are not logged in. Please log in to get access." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Result: Token verified, searching for user ID:", decoded.id);

        const currentUser = await Admin.findById(decoded.id);
        
        if (!currentUser) {
            console.log("Result: User not found in database");
            return res.status(401).json({ message: "The user belonging to this token no longer exists." });
        }

        req.user = currentUser;
        console.log("Result: Success! User attached to req.user");
        next();
    } catch (error) {
        console.log("Result: Catch block triggered, error:", error.message);
        return res.status(401).json({ message: "Invalid or expired token." });
    }
};