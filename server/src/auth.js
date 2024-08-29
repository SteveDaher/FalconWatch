    //Path: server/src/auth.js
    const express = require('express');
    const router = express.Router();
    const { query } = require('./db');
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    require('dotenv').config(); // Load environment variables from .env file
    
    /**
     * Route: POST /register
     * Handles user registration
     */
    router.post('/register', async (req, res) => {
        const { name, email, phone, password } = req.body;
    
        // Validate that all required fields are provided
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
    
        try {
            // Hash the password for security
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Insert the new user into the database
            const sql = 'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)';
            await query(sql, [name, email, phone, hashedPassword]);
            
            res.status(201).json({ success: true, message: 'Registration successful' });
        } catch (error) {
            console.error('Error during registration:', error); // Log the error for debugging
            res.status(500).json({ success: false, message: 'Server error' }); // Return a 500 status for server errors
        }
    });
    
    /**
     * Route: POST /login
     * Handles user login
     */
    router.post('/login', async (req, res) => {
        const { identifier, password } = req.body;
    
        // Validate that both the identifier and password are provided
        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'Email/Badge number and password are required' });
        }
    
        try {
            let sql, params;
    
            // Determine if the identifier is an email or a badge number
            if (identifier.includes('@')) {
                sql = 'SELECT * FROM users WHERE email = ?';
                params = [identifier];
            } else {
                sql = 'SELECT * FROM users WHERE badgeNumber = ?';
                params = [identifier];
            }
    
            const results = await query(sql, params);
    
            // Check if a user was found
            if (results.length === 0) {
                return res.status(400).json({ success: false, message: 'Invalid credentials' });
            }
    
            const user = results[0];
            
            // Compare the provided password with the stored hashed password
            const isMatch = await bcrypt.compare(password, user.password);
    
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Invalid credentials' });
            }
    
            // Generate a JWT token with the user's details
            const token = jwt.sign(
                { id: user.id, email: user.email, name: user.name, role: user.role }, // Ensure the role is included here
                process.env.JWT_SECRET,
                { expiresIn: '1h' } // Token expires in 1 hour
            );
    
            // Respond with the token and user details, including the role
            res.status(200).json({ 
                success: true, 
                token, 
                user: { id: user.id, name: user.name, role: user.role } // Ensure the role is sent back
            });
        } catch (error) {
            console.error('Error during login:', error); // Log the error for debugging
            res.status(500).json({ success: false, message: 'Server error' }); // Return a 500 status for server errors
        }
    });
    
    module.exports = router; // Export the router to be used in other parts of the application
    