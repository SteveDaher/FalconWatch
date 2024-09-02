    //Path: server/src/socket.js
    const { query } = require('./db');
    const jwt = require('jsonwebtoken');
    
    const users = {}; // Object to store connected users by their socket IDs
    
    /**
     * Function to set up Socket.IO event handlers
     * @param {Object} io - The Socket.IO server instance
     */
    function setupSocket(io) {
        io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);
    
            socket.on('authenticate', async ({ token }) => {
                try {
                    console.log('Received token:', token);
            
                    // Verify the JWT token
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
                    // Query the database to get user details
                    const results = await query('SELECT id, name, role FROM users WHERE id = ?', [decoded.id]);
            
                    if (results.length > 0) {
                        const user = results[0];
                        users[socket.id] = { id: user.id, name: user.name, role: user.role, online: true };
            
                        // Emit the authenticated event with correct structure
                        console.log('User authenticated:', user);
                        socket.emit('authenticated', { success: true, user: { id: user.id, name: user.name, role: user.role } });
            
                        // Broadcast the user's online status to other clients
                        socket.broadcast.emit('onlineStatusUpdate', { userId: user.id, isOnline: true });
                    } else {
                        console.log('No user found with ID:', decoded.id);
                        socket.emit('authenticated', { success: false });
                        socket.disconnect(true);
                    }
                } catch (error) {
                    console.error('Authentication error:', error.message || error);
                    socket.emit('authenticated', { success: false });
                    socket.disconnect(true);
                }
            });
            
            /**
             * Event: 'locationUpdate'
             * Handles the location updates sent by the client
             */
            socket.on('locationUpdate', (data) => {
                console.log('Received location update:', data);
    
                const { userId, userName, latitude, longitude } = data;
    
                // Validate the received data
                if (
                    typeof userId !== 'number' ||
                    typeof userName !== 'string' ||
                    typeof latitude !== 'number' ||
                    typeof longitude !== 'number' ||
                    isNaN(latitude) ||
                    isNaN(longitude)
                ) {
                    console.error('Invalid data received for location update:', data);
                    return socket.emit('error', { message: 'User ID and location are required' });
                }
    
                console.log(`Location update from user ${userId} (${userName}): ${latitude}, ${longitude}`);
    
                // Broadcast the location update to all other clients
                socket.broadcast.emit('locationUpdate', { userId, userName, latitude, longitude });
            });
    
            /**
             * Event: 'reportCrime'
             * Handles the submission of a crime report by the client
             */
            socket.on('reportCrime', async (data) => {
                console.log('Received report data:', data);
                const user = users[socket.id];
            
                if (!user) {
                    socket.emit('reportError', { message: 'User not authenticated.' });
                    return;
                }
            
                if (!data.coordinates || !data.description) {
                    socket.emit('reportError', { message: 'Coordinates and description are required.' });
                    return;
                }
            
                try {
                    // Parse the coordinates and validate them
                    const coordinates = data.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                    const [lng, lat] = coordinates;
            
                    if (isNaN(lng) || isNaN(lat)) {
                        socket.emit('reportError', { message: 'Invalid coordinates.' });
                        return;
                    }
            
                    // Insert the report into the database
                    const result = await query(
                        `INSERT INTO reports (category, description, severity, coordinates, userId) 
                         VALUES (?, ?, ?, POINT(?, ?), ?)`,
                        [data.category, data.description, data.severity || 'medium', lng, lat, user.id]
                    );
            
                    if (result.affectedRows > 0) {
                        // Fetch the newly inserted report from the database
                        const [newReport] = await query(
                            `SELECT id, category, description, severity, ST_X(coordinates) AS lng, ST_Y(coordinates) AS lat, created_at 
                             FROM reports WHERE id = ?`,
                            [result.insertId]
                        );
            
                        if (newReport) {
                            // Emit the new report to all connected clients
                            io.emit('newReport', newReport);
            
                            // Acknowledge successful report submission to the client
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
             * Handles the client disconnect event
             */
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
    
                // Find the user associated with this socket and update their status
                const userId = Object.keys(users).find(id => users[id].socketId === socket.id);
    
                if (userId) {
                    users[userId].online = false;
                    socket.broadcast.emit('onlineStatusUpdate', { userId, isOnline: false });
                    console.log(`User ${userId} has gone offline.`);
                    delete users[userId];
                }
            });
        });
    }
    
    module.exports = { setupSocket };
    