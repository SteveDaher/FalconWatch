// Path: server/src/serverChangeLogs.js

const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a db.js file for MySQL connections
const { authenticateToken } = require('./authMiddleware'); // Add this if not already present


// Get all changelog updates
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM changelog ORDER BY created_at DESC');
        res.json(result);
    } catch (error) {
        console.error('Error fetching changelog:', error);
        res.status(500).json({ error: 'Failed to fetch changelog.' });
    }
});

// Create a new changelog update
router.post('/create', authenticateToken, async (req, res) => {
    const { content } = req.body;
    const userId = req.user.id; // Assuming user is authenticated via middleware

    try {
        const latestVersionResult = await db.query('SELECT version FROM changelog ORDER BY created_at DESC LIMIT 1');
        let newVersion = '1.1'; // Default version

        if (latestVersionResult.length > 0) {
            const latestVersion = latestVersionResult[0].version;
            newVersion = incrementVersion(latestVersion);
        }

        await db.query('INSERT INTO changelog (version, content, created_by) VALUES (?, ?, ?)', [newVersion, content, userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error creating changelog:', error);
        res.status(500).json({ error: 'Failed to create changelog.' });
    }
});

// Helper function to increment the version
function incrementVersion(version) {
    let [major, minor] = version.split('.').map(Number);
    minor += 1;
    if (minor === 10) {
        major += 1;
        minor = 0;
    }
    return `${major}.${minor}`;
}

// Delete a changelog update by id
router.delete('/:id', authenticateToken, async (req, res) => {
    const changelogId = req.params.id;
    
    // Optionally: Ensure only police can delete (or you can handle this in middleware)
    if (req.user.role !== 'police') {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await db.query('DELETE FROM changelog WHERE id = ?', [changelogId]);

        if (result.affectedRows > 0) {
            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: 'Changelog not found' });
        }
    } catch (error) {
        console.error('Error deleting changelog:', error);
        return res.status(500).json({ error: 'Failed to delete changelog' });
    }
});


module.exports = router;
