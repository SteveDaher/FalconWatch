    // server/src/auth.js

const express = require('express');
const router = express.Router();
const { query } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Handle user registration
router.post('/register', async (req, res) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)';
        await query(sql, [name, email, phone, hashedPassword]);
        res.status(201).json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Handle user login
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'Email/Badge number and password are required' });
    }

    try {
        let sql, params;

        if (identifier.includes('@')) {
            sql = 'SELECT * FROM users WHERE email = ?';
            params = [identifier];
        } else {
            sql = 'SELECT * FROM users WHERE badgeNumber = ?';
            params = [identifier];
        }

        const results = await query(sql, params);

        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Include the user's role in the JWT payload
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ success: true, token, user: { id: user.id, name: user.name } });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


module.exports = router;

