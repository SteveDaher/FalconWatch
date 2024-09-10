// Path: server/src/authMiddleware.js
const { query, getUserByID } = require('./db');
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET; // Ensure the JWT secret key is defined in your .env file

/**
 * Middleware to authenticate JWT tokens in incoming requests
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @param {Function} next - The next middleware function in the stack
 */
const authenticateToken = (req, res, next) => {
    // Extract the token from the Authorization header, which is in the format "Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Only take the token part after "Bearer"
    
    // If no token is provided, respond with a 401 Unauthorized status
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Verify the token using the secret key
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err.message); // Log any token verification errors
            return res.status(403).json({ message: 'Forbidden: Invalid token' }); // Respond with a 403 Forbidden status if the token is invalid
        }

        // If the token is valid, attach the decoded user info to the request object for further use
        req.user = user;

        next(); // Proceed to the next middleware or route handler
    });
};

// Updated role-based access control for authenticateRole
const authenticateRole = (role) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const [user] = await query('SELECT role FROM users WHERE id = ?', [userId]);

            if (!user) {
                return res.redirect('/html/login.html'); // Redirect to login if user is not found
            }

            if (user.role !== role) {
                console.log(`Access denied: User ${userId} does not have the required role: ${role}`);
                return res.redirect('/html/login.html'); // Redirect if the role doesn't match
            }

            next(); // Proceed if the role is correct
        } catch (error) {
            console.error('Error checking role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };
};

// Export the middleware function for use in other parts of the application
module.exports = { authenticateToken, authenticateRole };
