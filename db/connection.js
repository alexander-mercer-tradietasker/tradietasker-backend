const { Pool } = require('pg');
const path = require('path');

// Determine if we're using PostgreSQL or SQLite
const usePostgres = !!process.env.DATABASE_URL;

let pool = null;
let sqlite3, db;

// Initialize database connection
function initDb() {
  if (usePostgres) {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });
      
      console.log('Connected to PostgreSQL database');
    }
    return pool;
  } else {
    // SQLite fallback for local development
    if (!db) {
      sqlite3 = require('sqlite3').verbose();
      const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'tradietasker.db');
      
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to connect to SQLite database:', err);
          throw err;
        }
        console.log('Connected to SQLite database at:', dbPath);
        db.run('PRAGMA foreign_keys = ON');
      });
    }
    return db;
  }
}

function getDb() {
  return initDb();
}

// Promisified query methods that work with both PostgreSQL and SQLite
async function query(sql, params = []) {
  initDb(); // Ensure pool is initialized
  if (usePostgres) {
    // Convert SQLite-style placeholders (?, ?) to PostgreSQL ($1, $2)
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex}`);
      paramIndex++;
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(pgSql, params);
      return result.rows;
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      getDb().all(sql, params, (err, rows) => {
        if (err) {
          console.error('Query error:', sql, params, err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

async function get(sql, params = []) {
  initDb(); // Ensure pool is initialized
  if (usePostgres) {
    // Convert SQLite-style placeholders
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex}`);
      paramIndex++;
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(pgSql, params);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      getDb().get(sql, params, (err, row) => {
        if (err) {
          console.error('Get error:', sql, params, err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

async function run(sql, params = []) {
  initDb(); // Ensure pool is initialized
  if (usePostgres) {
    // Convert SQLite-style placeholders
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex}`);
      paramIndex++;
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(pgSql, params);
      
      // For INSERT with RETURNING id
      if (result.rows && result.rows.length > 0 && result.rows[0].id) {
        return { lastID: result.rows[0].id, changes: result.rowCount };
      }
      
      return { lastID: null, changes: result.rowCount };
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      getDb().run(sql, params, function(err) {
        if (err) {
          console.error('Run error:', sql, params, err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }
}

// Close connection (for graceful shutdown)
async function close() {
  if (usePostgres && pool) {
    await pool.end();
    pool = null;
  } else if (db) {
    return new Promise((resolve) => {
      db.close(() => resolve());
    });
  }
}

// Helper to get current timestamp in SQL
function now() {
  return usePostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')";
}

module.exports = {
  getDb,
  query,
  get,
  run,
  close,
  now,
  isPostgres: usePostgres
};
