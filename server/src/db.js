    //Path: server/src/db.js
    const mysql = require('mysql');
    require('dotenv').config(); // Load environment variables from .env file
    
    // Create a connection pool to manage multiple database connections
    const pool = mysql.createPool({
        connectionLimit: 10, // Limit the number of connections in the pool
        host: process.env.DB_HOST, // Database host, loaded from environment variables
        user: process.env.DB_USER, // Database user, loaded from environment variables
        password: process.env.DB_PASSWORD, // Database password, loaded from environment variables
        database: process.env.DB_NAME // Database name, loaded from environment variables
    });
    
    // Establish a connection to the database to verify that the connection is successful
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err); // Log connection errors
        } else {
            console.log('Database connection successful');
            connection.release(); // Release the connection back to the pool
        }
    });
    
    /**
     * Function to perform a database query
     * @param {string} sql - The SQL query string
     * @param {Array} params - The parameters for the SQL query
     * @returns {Promise} - Resolves with the query results, or rejects with an error
     */
    function query(sql, params) {
        return new Promise((resolve, reject) => {
            pool.query(sql, params, (error, results) => {
                if (error) {
                    console.error('Database query error:', error); // Log query errors
                    return reject(error); // Reject the promise with the error
                }
                resolve(results); // Resolve the promise with the query results
            });
        }); 
    }          

/**
 * Function to get user information by ID
 * @param {number} userId - The ID of the user to retrieve
 * @returns {Promise} - Resolves with the user object, or rejects with an error
 */
async function getUserByID(userId) {
    try {
        const [user] = await query('SELECT id, name, role FROM users WHERE id = ?', [userId]);
        return user;
    } catch (error) {
        console.error('Error fetching user from database:', error);
        throw error;
    }
}

module.exports = { query, getUserByID }; // Export the query and getUserByID functions for use in other modules