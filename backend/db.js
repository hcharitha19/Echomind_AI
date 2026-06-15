// config/db.js — Production-grade MySQL pool with retry
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

const createPool = () => {
  return mysql.createPool({
    host:            process.env.DB_HOST     || 'localhost',
    port:      parseInt(process.env.DB_PORT  || '3306'),
    user:            process.env.DB_USER     || 'root',
    password:        process.env.DB_PASSWORD || '',
    database:        process.env.DB_NAME     || 'echomind_db',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:          0,
    enableKeepAlive:  true,
    keepAliveInitialDelay: 0,
    timezone: 'Z',
    charset:  'utf8mb4',
  });
};

const getPool = () => {
  if (!pool) pool = createPool();
  return pool;
};

// Test connection on startup
const testConnection = async (retries = 5, delay = 3000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await getPool().getConnection();
      console.log('✅  MySQL connected successfully');
      conn.release();
      return true;
    } catch (err) {
      console.error(`❌  MySQL connection attempt ${i}/${retries} failed:`, err.message);
      if (i < retries) {
        console.log(`⏳  Retrying in ${delay / 1000}s…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  console.error('💀  Could not connect to MySQL after all retries. Exiting.');
  process.exit(1);
};

// Convenience query wrapper with error context
const query = async (sql, params = []) => {
  try {
    const [rows] = await getPool().execute(sql, params);
    return rows;
  } catch (err) {
    console.error('DB query error:', err.message, '| SQL:', sql.slice(0, 120));
    throw err;
  }
};

module.exports = { getPool, testConnection, query };