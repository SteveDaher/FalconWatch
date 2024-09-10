// Path: server/src/socket.js
const { query } = require('./db');
const jwt = require('jsonwebtoken');

const users = {}; // Object to store connected users by their socket IDs

/**
 * Function to set up Socket.IO event handlers
 * @param {Object} io - The Socket.IO server instance
 */
function setupSocket(io) {
    // Event handler for a new client connection
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        /**
         * Event: 'authenticate'
         * Handles authentication using JWT tokens
         */
        socket.on('authenticate', async ({ token }) => {
            try {
                console.log('Received token:', token);

                // Verify the JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Fetch user details from the database using the decoded user ID
                const results = await query('SELECT id, name, role FROM users WHERE id = ?', [decoded.id]);

                if (results.length > 0) {
                    const user = results[0];
                    users[socket.id] = { id: user.id, name: user.name, role: user.role, online: true };

                    // Emit success event back to the client
                    socket.emit('authenticated', { success: true, user: { id: user.id, name: user.name, role: user.role } });

                    // Broadcast user's online status to other connected clients
                    socket.broadcast.emit('onlineStatusUpdate', { userId: user.id, isOnline: true });
                } else {
                    socket.emit('authenticated', { success: false });
                    socket.disconnect(true); // Disconnect the client if authentication fails
                }
            } catch (error) {
                console.error('Authentication error:', error.message || error);
                socket.emit('authenticated', { success: false });
                socket.disconnect(true); // Disconnect the client if authentication fails
            }
        });

        /**
         * Event: 'locationUpdate'
         * Handles location updates from the client
         */
        socket.on('locationUpdate', (data) => {

            const { userId, userName, latitude, longitude } = data;

            // Validate the location data
            if (typeof userId !== 'number' || typeof userName !== 'string' ||
                typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
                console.error('Invalid data received for location update:', data);
                return socket.emit('error', { message: 'User ID and valid location are required' });
            }

            // Broadcast the location update to other connected clients
            socket.broadcast.emit('locationUpdate', { userId, userName, latitude, longitude });
        });

        /**
         * Event: 'reportCrime'
         * Handles crime report submissions from the client
         */
        socket.on('reportCrime', async (data) => {
            console.log('Received report data:', data);
            const user = users[socket.id];

            if (!user) {
                return socket.emit('reportError', { message: 'User not authenticated.' });
            }

            if (!data.coordinates || !data.description) {
                return socket.emit('reportError', { message: 'Coordinates and description are required.' });
            }

            try {
                // Parse and validate the coordinates
                const coordinates = data.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                const [lng, lat] = coordinates;

                if (isNaN(lng) || isNaN(lat)) {
                    return socket.emit('reportError', { message: 'Invalid coordinates.' });
                }

                // Insert the crime report into the database
                const result = await query(
                    `INSERT INTO reports (category, description, severity, coordinates, userId) 
                     VALUES (?, ?, ?, POINT(?, ?), ?)`,
                    [data.category, data.description, data.severity || 'medium', lng, lat, user.id]
                );

                if (result.affectedRows > 0) {
                    // Fetch the newly created report
                    const [newReport] = await query(
                        `SELECT id, category, description, severity, ST_X(coordinates) AS lng, ST_Y(coordinates) AS lat, created_at 
                         FROM reports WHERE id = ?`,
                        [result.insertId]
                    );

                    if (newReport) {
                        // Broadcast the new report to all connected clients
                        io.emit('newReport', newReport);

                        // Send success acknowledgment to the reporting client
                        socket.emit('reportSuccess', { message: 'Report submitted successfully.' });
                    } else {
                        socket.emit('reportError', { message: 'Failed to retrieve the new report from the database.' });
                    }
                } else {
                    socket.emit('reportError', { message: 'Failed to submit the report.' });
                }
            } catch (error) {
                console.error('Error saving report:', error);
                socket.emit('reportError', { message: 'Internal server error.' });
            }
        });

        /**
         * Event: 'disconnect'
         * Handles client disconnection
         */
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);

            const userId = users[socket.id]?.id;

            if (userId) {
                // Mark the user as offline
                socket.broadcast.emit('onlineStatusUpdate', { userId, isOnline: false });
                console.log(`User ${userId} has gone offline.`);
                delete users[socket.id]; // Remove the user from the users object
            }
        });
    });
}

module.exports = { setupSocket }; // Export the setupSocket function for use in the server
