require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

// Webhook routes MUST come before bodyParser.json() middleware
// Stripe requires raw body for signature verification
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);

// Middleware
app.use(cors({
  origin: ['https://tradietasker.com.au', 'http://localhost:5173'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database status check
app.get('/api/status/db', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const { query } = require('./db/connection');
  
  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'db', 'tradietasker.db');
  
  try {
    const dbExists = fs.existsSync(DB_PATH);
    const dbSize = dbExists ? fs.statSync(DB_PATH).size : 0;
    
    // Try to query the database
    let tableCount = 0;
    let userCount = 0;
    let jobCount = 0;
    let error = null;
    
    try {
      const tables = await query("SELECT name FROM sqlite_master WHERE type='table'");
      tableCount = tables.length;
      
      const users = await query('SELECT COUNT(*) as count FROM users');
      userCount = users[0]?.count || 0;
      
      const jobs = await query('SELECT COUNT(*) as count FROM jobs');
      jobCount = jobs[0]?.count || 0;
    } catch (err) {
      error = err.message;
    }
    
    res.json({
      database: {
        path: DB_PATH,
        exists: dbExists,
        sizeBytes: dbSize,
        tables: tableCount,
        users: userCount,
        jobs: jobCount,
        error
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const professionRoutes = require('./routes/professions');
const jobTypeRoutes = require('./routes/jobTypes');
const subscriptionRoutes = require('./routes/subscriptions');
const creditRoutes = require('./routes/credits');
const jobRoutes = require('./routes/jobs');
const contactRoutes = require('./routes/contact');
const taskerRoutes = require('./routes/taskers');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const stripeRoutes = require('./routes/stripe');
const profileUnlockRoutes = require('./routes/profileUnlocks');
const customerRoutes = require('./routes/customers');
const transactionRoutes = require('./routes/transactions');
const messageRoutes = require('./routes/messages');
const invoiceRoutes = require('./routes/invoices');
const adminSettingsRoutes = require('./routes/adminSettings');
const migrationRoutes = require('./routes/migrations');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professions', professionRoutes);
app.use('/api/job-types', jobTypeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/taskers', taskerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/profile-unlocks', profileUnlockRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/migrations', migrationRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database before starting server
async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('Using SQLite - no initialization needed');
    return;
  }
  
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('Checking PostgreSQL database...');
    const result = await pool.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`);
    const tableCount = parseInt(result.rows[0].count);
    
    if (tableCount === 0) {
      console.log('Database empty, initializing schema...');
      
      const schemaPath = path.join(__dirname, 'db', 'schema-postgres.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✓ Schema initialized');
        
        // Seed professions
        const profsPath = path.join(__dirname, 'seeds', '002_professions_seed_pg.sql');
        if (fs.existsSync(profsPath)) {
          await pool.query(fs.readFileSync(profsPath, 'utf8'));
          console.log('✓ Professions seeded');
        }
        
        // Seed job types
        const jobsPath = path.join(__dirname, 'seeds', '003_job_types_seed_pg.sql');
        if (fs.existsSync(jobsPath)) {
          await pool.query(fs.readFileSync(jobsPath, 'utf8'));
          console.log('✓ Job types seeded');
        }
        
        // Create test customer
        const hash = await bcrypt.hash('password123', 10);
        await pool.query(
          `INSERT INTO users (name, email, password_hash, phone, role, tier, credits, created_at)
           VALUES ($1, $2, $3, $4, 'poster', 'free', 0, NOW())
           ON CONFLICT (email) DO NOTHING`,
          ['Test Customer', 'test@example.com', hash, '0400000000']
        );
        console.log('✓ Test customer created');
      }
    } else {
      console.log(`✓ Database ready (${tableCount} tables)`);
    }
  } catch (error) {
    console.error('Database initialization error:', error.message);
  } finally {
    await pool.end();
  }
}

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TradieTasker backend running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(error => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
