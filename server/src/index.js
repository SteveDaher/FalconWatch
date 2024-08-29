// Path: server/src/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const authRoutes = require('./auth');
const { setupSocket } = require('./socket');
const authenticateToken = require('./authMiddleware'); // Middleware for token authentication
const { query, getUserByID } = require('./db');
require('dotenv').config();  // Load environment variables

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Initialize Socket.IO with the server

const port = process.env.PORT || 3000;  // Set server port


setupSocket(io); // Pass the Socket.IO instance to the setup function


// List of public routes that don't require authentication
const publicRoutes = [
    '/html/index.html',
    '/html/register.html',
    '/html/login.html',
    '/api/users/login',  // Ensure login route is listed here
    '/api/users/register'  // And register if applicable
];

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to log requests and responses
app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[Request] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
    });
    console.log(`[Request] ${req.method} ${req.originalUrl}`);
    next();
});

// Serve the Socket.IO client library
app.use('/socket.io', express.static(path.join(__dirname, '../../node_modules/socket.io/client-dist')));
console.log(`[Setup] Serving Socket.IO from ${path.join(__dirname, '../../node_modules/socket.io/client-dist')}`);

// Serve static files from the 'client/public' directory
app.use(express.static(path.join(__dirname, '../../client/public')));
console.log(`[Setup] Serving static files from ${path.join(__dirname, '../../client/public')}`);

// Publicly accessible routes (login, register, index)
app.get(publicRoutes, (req, res) => {
    const requestedPath = path.join(__dirname, `../../client/public${req.path}`);
    res.sendFile(requestedPath);
});

// Apply authentication middleware to all routes except public routes
app.use((req, res, next) => {
    if (publicRoutes.includes(req.path)) {
        return next(); // Skip authentication for public routes
    }
    return authenticateToken(req, res, next); // Authenticate all other routes
});

// Add this route to return the user's name

app.get('/api/user-info', authenticateToken, async (req, res) => {
    try {
        console.log('User info endpoint hit');

        const userId = req.user.id; // Assuming req.user is populated by authenticateToken middleware
        if (!userId) {
            return res.status(400).json({ message: 'User ID not found in request' });
        }

        const user = await getUserByID(userId); // Ensure this function is properly defined and accessible
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Respond with the user's ID, name, and role
        res.json({ id: user.id, name: user.name, role: user.role });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// API routes for user authentication
app.use('/api/users', authRoutes);

// API endpoint to fetch reports, accessible only by authenticated users with the 'police' role
app.get('/api/reports', authenticateToken, async (req, res) => {
    console.log('Received request to /api/reports');
    console.log('Token in /api/reports:', req.headers['authorization']);

    try {
        if (req.user.role !== 'police') {
            return res.status(403).json({ message: 'Access forbidden: Police role required.' });
        }
        const reports = await query('SELECT * FROM reports');
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// API endpoint to fetch report history, accessible only by authenticated users with the 'police' role
app.use('/api/reportHistory', authenticateToken, async (req, res) => {
    console.log('Received request to /api/reportHistory');
    console.log('Token in /api/reportHistory:', req.headers['authorization']);

    try {
        if (req.user.role !== 'police') {
            return res.status(403).json({ message: 'Access forbidden: Police role required.' });
        }
        const reports = await query(`
            SELECT 
                id AS incidentId, 
                category, 
                description, 
                severity, 
                ST_X(coordinates) AS lng, 
                ST_Y(coordinates) AS lat, 
                created_at AS date
            FROM reports
        `);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// API endpoint to update online status
app.post('/api/users/onlineStatus', authenticateToken, async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }
    try {
        await query('UPDATE users SET online = ? WHERE id = ?', [true, userId]);
        res.status(200).json({ message: 'Status updated' });
    } catch (error) {
        console.error('Error updating online status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Middleware to protect admin page and ensure only 'police' role users can access
app.get('/admin', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Assuming authenticateToken attaches user info to req
        const [user] = await query('SELECT role FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.redirect('/html/login.html'); // Redirect to login if user is not found
        }
        if (user.role !== 'police') {
            return res.redirect('/html/login.html'); // Redirect to login if the role is not 'police'
        }
        res.sendFile(path.join(__dirname, '../../client/public/html/admin.html')); // Serve admin page if role is correct
    } catch (error) {
        console.error('Error checking user role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Middleware to protect reportHistory page and ensure only 'police' role users can access
app.use('/reportHistory', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.id; // Assuming authenticateToken attaches user info to req
        const [user] = await query('SELECT role FROM user WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.role !== 'police') {
            return res.status(403).json({ message: 'Access denied: Police role required.' });
        }
        next(); // Continue if the role is 'police'
    } catch (error) {
        console.error('Error checking user role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Protected API endpoint to fetch chart data, accessible only by authenticated users
app.get('/api/chartData', authenticateToken, async (req, res) => {
    console.log('Received request to /api/chartData');

    const { month } = req.query;

    try {
        let queryText = `
            SELECT 
                YEAR(DATE_SUB(created_at, INTERVAL 4 HOUR)) AS year, 
                MONTH(DATE_SUB(created_at, INTERVAL 4 HOUR)) AS month, 
                HOUR(DATE_SUB(created_at, INTERVAL 4 HOUR)) AS hour,
                severity, 
                category,
                COUNT(*) AS count,
                GROUP_CONCAT(id) AS incidentIds
            FROM reports
        `;

        const conditions = [];
        const params = [];

        if (month) {
            const [year, monthPart] = month.split('-');
            conditions.push('YEAR(DATE_SUB(created_at, INTERVAL 4 HOUR)) = ? AND MONTH(DATE_SUB(created_at, INTERVAL 4 HOUR)) = ?');
            params.push(year, monthPart);
        }

        if (conditions.length > 0) {
            queryText += ` WHERE ${conditions.join(' AND ')}`;
        }

        queryText += `
            GROUP BY year, month, hour, severity, category
            ORDER BY year, month, hour
        `;

        const rows = await query(queryText, params);
        res.json(rows || []);
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Route to assign badge number and update user role
app.post('/assign-badge', authenticateToken, async (req, res) => {
    const { email, badgenumber } = req.body;

    console.log('Received request:', { email, badgenumber });

    if (!email || !badgenumber) {
        console.log('Validation failed: Missing email or badgenumber');
        return res.status(400).json({ message: 'Email and badge number are required.' });
    }

    try {
        const queryText = `
            UPDATE users 
            SET badgenumber = ?, role = 'police'
            WHERE email = ?
        `;
        console.log('Executing query:', queryText);

        const result = await query(queryText, [badgenumber, email]);

        if (result.affectedRows > 0) {
            console.log('Badge number assigned successfully');
            res.json({ message: 'Badge number assigned and role updated to police.' });
        } else {
            console.log('User not found');
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error('Error assigning badge number:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Serve the main HTML file (index.html) for all other routes
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
        return next(); // Skip for Socket.IO requests
    }

    const requestedPath = path.join(__dirname, `../../client/public/html${req.path}.html`);
    
    console.log(`[Wildcard Route] Requested Path: ${requestedPath}`);
    
    res.sendFile(requestedPath, (err) => {
        if (err) {
            console.log(`[Error] Failed to serve ${requestedPath}: ${err.message}`);
            if (err.code === 'ENOENT') {
                console.log('File not found, serving index.html instead.');
                res.sendFile(path.join(__dirname, '../../client/public/index.html'));
            }
        }
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
