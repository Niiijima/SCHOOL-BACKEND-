exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        //  Ensure the 'protect' middleware has run and populated req.user
        if (!req.user || !req.user.role) {
            return res.status(401).json({ 
                message: "Authentication required: Please log in." 
            });
        }

        //  Check the user's role from the verified database record
        if (!allowedRoles.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({ 
                message: `Forbidden: Your role (${req.user.role}) does not have permission to access this resource.` 
            });
        }

        // 3. Authorized: Proceed to the controller
        next();
    };
};