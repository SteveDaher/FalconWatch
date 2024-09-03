// Path: server/src/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const authRoutes = require('./auth');
const { setupSocket } = require('./socket');
const multer = require('multer');
const authenticateToken = require('./authMiddleware'); // Middleware for token authentication
const { query, getUserByID } = require('./db');
require('dotenv').config();  // Load environment variables

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Initialize Socket.IO with the server

const port = process.env.PORT || 3000;  // Set server port

const UPLOAD_DIR = '/var/www/html/falconwatch/server/uploads';


// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadDir = '/var/www/html/falconwatch/server/uploads';
        
        if (file.mimetype.startsWith('image/')) {
            uploadDir = path.join(uploadDir, 'images');
            console.log("Detected image, uploading to:", uploadDir);

        } else if (file.mimetype.startsWith('video/')) {
            uploadDir = path.join(uploadDir, 'videos');
            console.log("Detected video, uploading to:", uploadDir);
        } else {
            console.log("Detected unknown file type, uploading to default directory:", uploadDir);
        }

        // Ensure the directory exists
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage }); // Initialize multer with the storage configuration

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

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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



// Middleware to authenticate and authorize access to /uploads/
app.use('/uploads', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.id;  // Assuming req.user is populated by authenticateToken middleware
        const [user] = await query('SELECT role FROM users WHERE id = ?', [userId]);

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
}, express.static('/var/www/html/falconwatch/server/uploads'));


//POST (SUBMITTING A REPORT)
app.post('/api/reports', authenticateToken, upload.single('crime-attachment'), async (req, res) => {
    console.log(`Request made to /api/reports with method ${req.method}`);
    try {
        console.log('Report submission started');
        const { category, description, coordinates, severity } = req.body;
        const userId = req.user.id;

        let fileType = null;
        let filePath = null;

        if (req.file) {
            if (req.file.mimetype.startsWith('image/')) {
                fileType = 'image';
                filePath = `/uploads/images/${req.file.filename}`;
            } else if (req.file.mimetype.startsWith('video/')) {
                fileType = 'video';
                filePath = `/uploads/videos/${req.file.filename}`;
            }

            console.log(`File uploaded as a ${fileType} to ${filePath}`);
        } else {
            console.log('No file uploaded');
        }

        const [lng, lat] = coordinates.split(',').map(coord => parseFloat(coord.trim()));

        const result = await query(
            `INSERT INTO reports (category, description, severity, coordinates, userId, file_type, file_path) 
            VALUES (?, ?, ?, POINT(?, ?), ?, ?, ?)`,
            [
                category, 
                description, 
                severity || 'medium', 
                lng, 
                lat, 
                userId, 
                fileType, 
                filePath
            ]
        );

        if (result.affectedRows > 0) {
            console.log('Report successfully saved to the database');

            // Fetch the newly inserted report
            const [newReport] = await query(
                `SELECT id, category, description, severity, ST_X(coordinates) AS lng, ST_Y(coordinates) AS lat, created_at, file_type, file_path 
                 FROM reports WHERE id = ?`,
                [result.insertId]
            );

            // Emit the new report to all connected clients with file information
            io.emit('newReport', newReport);

            res.status(200).json({ message: 'Report submitted successfully.' });
        } else {
            console.log('Failed to save the report to the database');
            res.status(500).json({ message: 'Failed to submit the report.' });
        }
    } catch (error) {
        console.error('Error handling report submission:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


//GET FETCHING A REPORT
app.get('/api/reports', authenticateToken, async (req, res) => {
    console.log(`Request made to /api/reports with method ${req.method}`);
    try {
        const reports = await query(
            `SELECT id, category, description, severity, ST_X(coordinates) AS lng, ST_Y(coordinates) AS lat, created_at, file_type, file_path 
             FROM reports`
        );
        res.status(200).json(reports);
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

// Route to handle police account operations: fetch, update, delete
app.route('/api/police-accounts')
    .get(authenticateToken, async (req, res) => {
        // Fetch police accounts with search functionality
        const searchQuery = req.query.search || '';

        try {
            const queryText = `
                SELECT badgeNumber, name, email, role, created_at, phone
                FROM users
                WHERE (role = 'police' OR badgeNumber IS NOT NULL)
                AND (name LIKE ? OR badgeNumber LIKE ?)
            `;
            const searchTerm = `%${searchQuery}%`;

            console.log('Executing query:', queryText, 'with search term:', searchTerm);

            const results = await query(queryText, [searchTerm, searchTerm]);

            if (results.length > 0) {
                console.log('Police accounts fetched successfully:', results);
                res.json(results);
            } else {
                console.log('No police accounts found for the search query:', searchQuery);
                res.status(404).json({ message: 'No police accounts found.' });
            }
        } catch (error) {
            console.error('Error fetching police accounts:', error);
            res.status(500).json({ message: 'Internal server error.' });
        }
    })
    .post(authenticateToken, async (req, res) => {
        // Update user role
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ message: 'Email and role are required.' });
        }

        try {
            const queryText = `UPDATE users SET role = ? WHERE email = ?`;
            const result = await query(queryText, [role, email]);

            if (result.affectedRows > 0) {
                res.json({ success: true, message: 'Role updated successfully.' });
            } else {
                res.status(404).json({ success: false, message: 'User not found.' });
            }
        } catch (error) {
            console.error('Error updating role:', error);
            res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    })
    .delete(authenticateToken, async (req, res) => {
        // Delete user account
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        try {
            const queryText = `DELETE FROM users WHERE email = ?`;
            const result = await query(queryText, [email]);

            if (result.affectedRows > 0) {
                res.json({ success: true, message: 'Account deleted successfully.' });
            } else {
                res.status(404).json({ success: false, message: 'User not found.' });
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    });


// Route to wipe all reports
app.post('/wipe-reports', authenticateToken, async (req, res) => {
    if (req.user.role !== 'police') {
        return res.status(403).json({ message: 'Access forbidden: Police role required.' });
    }

    try {
        const result = await query('DELETE FROM reports');

        if (result.affectedRows > 0) {
            console.log('All reports have been wiped from the database.');
            res.json({ message: 'All reports have been successfully wiped.' });
        } else {
            res.status(404).json({ message: 'No reports found to wipe.' });
        }
    } catch (error) {
        console.error('Error wiping reports:', error);
        res.status(500).json({ message: 'Internal server error.' });
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
