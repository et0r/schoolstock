require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Pools don't connect immediately like a single connection does — they open
// connections lazily on first use. To get an early, clear signal that the
// DB is reachable (rather than finding out on the first real API request),
// we grab one connection from the pool right away, just to test it.
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log(`✅ MySQL connected successfully (DB: ${process.env.DB_NAME}, host: ${process.env.DB_HOST})`);
        connection.release(); // give the connection back to the pool, don't hold onto it
    } catch (err) {
        console.error('❌ Failed to connect to MySQL on startup:', err.message);
    }
})();

module.exports = pool;