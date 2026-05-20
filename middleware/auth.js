// middleware/auth.js

exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        // Look for the user's role in the request headers
        const userRole = req.headers['role']; 

        if (!userRole) {
            return res.status(401).json({ 
                message: "Access Denied: No identification role provided in headers." 
            });
        }

        // Check if the user's role is included in the allowed roles array
        if (!allowedRoles.includes(userRole.toLowerCase())) {
            return res.status(403).json({ 
                message: `Forbidden: Your role (${userRole}) does not have permission to access this resource.` 
            });
        }

        // If everything checks out, pass control to the next middleware or controller!
        next();
    };
};