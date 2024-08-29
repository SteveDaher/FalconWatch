    //Path: server/src/authMiddleware.js
    const jwt = require('jsonwebtoken');
    const secretKey = process.env.JWT_SECRET; // Ensure this key is set in your .env file
    
    /**
     * Middleware to authenticate JWT tokens in incoming requests
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     * @param {Function} next - The next middleware function in the stack
     */
    const authenticateToken = (req, res, next) => {
        // Get the Authorization header and extract the token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
    
        // If no token is provided, return a 401 Unauthorized response
        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ message: 'Unauthorized: No token provided' });
        }
        
        // Verify the token using the secret key
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                console.error('Token verification failed:', err.message); // Log verification errors
                return res.status(403).json({ message: 'Forbidden: Invalid token' }); // Return a 403 Forbidden response for invalid tokens
            }
    
            req.user = user; // Attach user info to the request object for later use
            console.log(`Token verified successfully for user: ${user.id}, role: ${user.role}`);
            next(); // Proceed to the next middleware function
        });
    };
    
    module.exports = authenticateToken; // Export the middleware function for use in other parts of the application
    
