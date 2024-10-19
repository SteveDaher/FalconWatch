// Path: server/src/db.js
const mysql = require('mysql');
require('dotenv').config(); // Load environment variables from the .env file

// Create a connection pool to manage multiple connections to the database
const pool = mysql.createPool({
    connectionLimit: 10, // Limit the number of active connections in the pool to 10
    host: process.env.DB_HOST, // Load the database host from the environment variables
    user: process.env.DB_USER, // Load the database user from the environment variables
    password: process.env.DB_PASSWORD, // Load the database password from the environment variables
    database: process.env.DB_NAME // Load the database name from the environment variables
});

/**
 * Function to establish an initial connection to the database and verify connectivity
 */
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err.message); // Log any connection errors for debugging
    } else {
        console.log('Database connection successful'); // Connection established successfully
        connection.release(); // Release the connection back to the pool
    }
});

/**
 * Function to perform a database query
 * This function wraps MySQL's query method in a promise, allowing async/await usage.
 * @param {string} sql - The SQL query string
 * @param {Array} params - The parameters for the SQL query
 * @returns {Promise} - Resolves with the query results, or rejects with an error
 */
function query(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (error, results) => {
            if (error) {
                console.error('Database query error:', error.message); // Log the query error details
                return reject(error); // Reject the promise with the error
            }
            resolve(results); // Resolve the promise with the query results
        });
    });
}

/**
 * Function to fetch a user by their ID
 * @param {number} userId - The ID of the user to retrieve
 * @returns {Promise<Object>} - Resolves with the user object (id, name, role), or rejects with an error
 */
async function getUserByID(userId) {
    try {
        // Query to fetch user details (id, name, role) by user ID
        const [user] = await query('SELECT id, name, role FROM users WHERE id = ?', [userId]);
        return user; // Return the user object
    } catch (error) {
        console.error('Error fetching user from the database:', error.message); // Log error if query fails
        throw error; // Rethrow the error for handling in the calling function
    }
}

module.exports = { query, getUserByID }; // Export the query and getUserByID functions for use in other modules
