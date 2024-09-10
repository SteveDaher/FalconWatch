// Path: server/src/auth.js
const express = require('express');
const router = express.Router();
const { query } = require('./db'); // Import query function for database operations
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT token creation
require('dotenv').config(); // Load environment variables from the .env file

/**
 * Route: POST /register
 * Handles user registration by inserting new user data into the database.
 */
router.post('/register', async (req, res) => {
    const { name, email, phone, password } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        // Hash the password for secure storage
        const hashedPassword = await bcrypt.hash(password, 10);

        // SQL query to insert new user into the database
        const sql = 'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)';
        await query(sql, [name, email, phone, hashedPassword]);

        // Respond with success if registration is complete
        res.status(201).json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Error during registration:', error); // Log any registration errors
        res.status(500).json({ success: false, message: 'Server error' }); // Return server error
    }
});

/**
 * Route: POST /login
 * Handles user login by verifying credentials and generating a JWT token.
 */
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    // Validate the presence of both identifier and password
    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'Email/Badge number and password are required' });
    }

    try {
        let sql, params;

        // Check if the identifier is an email or badge number
        if (identifier.includes('@')) {
            sql = 'SELECT * FROM users WHERE email = ?';
            params = [identifier];
        } else {
            sql = 'SELECT * FROM users WHERE badgeNumber = ?';
            params = [identifier];
        }

        // Execute the query to find the user
        const results = await query(sql, params);

        // If no user is found, return an error
        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const user = results[0]; // Get the user object

        // Compare the input password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate a JWT token with user information (id, email, role, etc.)
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role }, // Include role in token
            process.env.JWT_SECRET, // Secret key from environment variable
            { expiresIn: '1h' } // Token expiry set to 1 hour
        );

        // Respond with the JWT token and user details (including role)
        res.status(200).json({ 
            success: true, 
            token, 
            user: { id: user.id, name: user.name, role: user.role } // Return user details with role
        });
    } catch (error) {
        console.error('Error during login:', error); // Log any login errors
        res.status(500).json({ success: false, message: 'Server error' }); // Return server error
    }
});

module.exports = router; // Export the router to be used in the application
