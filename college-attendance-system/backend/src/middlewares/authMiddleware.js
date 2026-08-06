const jwt = require('jsonwebtoken');

/**
 * Verify JWT Token Middleware
 * Extracts Bearer Token from Authorization Header and verifies validity
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: 'fail',
            message: 'Access denied. No authentication token provided.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user payload ({ id, role, email }) to request
        next();
    } catch (error) {
        return res.status(403).json({
            status: 'fail',
            message: 'Invalid or expired authentication token.'
        });
    }
};

/**
 * Role Authorization Middleware Factory
 * Enforces strict Role-Based Access Control (RBAC) across portals
 * @param {...string} allowedRoles - Permitted user roles, e.g., 'Admin', 'Teacher', 'Student'
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'fail',
                message: `Forbidden: Unauthorized access for role '${req.user?.role || 'Guest'}'.`
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    authorizeRoles
};
