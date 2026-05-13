const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Simple secret-based authentication (not for production long-term)
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'tradie-migration-secret-2026';

router.post('/run-tradie-dashboard', async (req, res) => {
  try {
    const { secret } = req.body;
    
    if (secret !== MIGRATION_SECRET) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not configured' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const migrationPath = path.join(__dirname, '..', 'migrations', '007_tradie_dashboard_enhancements.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migration);
    await pool.end();
    
    res.json({ 
      message: 'Migration 007_tradie_dashboard_enhancements.sql applied successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      details: error.message 
    });
  }
});

router.post('/seed-tradie-test-data', async (req, res) => {
  try {
    const { secret } = req.body;
    
    if (secret !== MIGRATION_SECRET) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not configured' });
    }

    // Import the seeding logic inline
    const bcrypt = require('bcryptjs');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const passwordHash = await bcrypt.hash('password123', 10);
      
      // Create test tradie
      const tradieResult = await client.query(`
        INSERT INTO users (
          name, email, password_hash, phone, role, tier, credits,
          business_name, abn, business_address, service_postcode, service_radius_km,
          notification_prefs, created_at
        )
        VALUES ($1, $2, $3, $4, 'tasker', 'bronze', 5, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (email) DO UPDATE SET
          role = EXCLUDED.role,
          tier = EXCLUDED.tier,
          credits = EXCLUDED.credits,
          business_name = EXCLUDED.business_name
        RETURNING id
      `, [
        'Test Tradie',
        'tradie@test.com',
        passwordHash,
        '0400111222',
        'Test Tradie Plumbing',
        '12345678901',
        '123 Trade St, Sydney NSW',
        '2000',
        25,
        JSON.stringify({ email: true, sms: false })
      ]);
      
      const tradieId = tradieResult.rows[0].id;
      
      // Add qualifications
      await client.query(`
        INSERT INTO user_qualifications (user_id, type, name, issuer, year_obtained, created_at)
        VALUES 
          ($1, 'licence', 'Plumbing Licence NSW', 'NSW Fair Trading', 2018, NOW()),
          ($1, 'certificate', 'White Card', 'Safe Work Australia', 2017, NOW()),
          ($1, 'other', 'Backflow Prevention', 'Master Plumbers Association', 2019, NOW())
        ON CONFLICT DO NOTHING
      `, [tradieId]);
      
      // Create test customer
      const customerResult = await client.query(`
        INSERT INTO users (
          name, email, password_hash, phone, role, tier, credits, created_at
        )
        VALUES ($1, $2, $3, $4, 'poster', 'free', 10, NOW())
        ON CONFLICT (email) DO UPDATE SET credits = EXCLUDED.credits
        RETURNING id
      `, ['Test Customer', 'customer@test.com', passwordHash, '0400333444']);
      
      const customerId = customerResult.rows[0].id;
      
      // Create test jobs
      const jobs = [
        {
          title: 'Kitchen Sink Leak Repair',
          description: 'Kitchen sink is leaking underneath. Need urgent repair.',
          budget_min: 150,
          budget_max: 300,
          suburb: 'Parramatta',
          postcode: '2150',
          status: 'open'
        },
        {
          title: 'Bathroom Renovation Plumbing',
          description: 'Complete bathroom renovation. Need new plumbing for shower, sink, and toilet.',
          budget_min: 2000,
          budget_max: 4000,
          suburb: 'Penrith',
          postcode: '2750',
          status: 'Applied'
        },
        {
          title: 'Hot Water System Installation',
          description: 'Old hot water system needs replacement. Looking for electric system.',
          budget_min: 800,
          budget_max: 1500,
          suburb: 'Campbelltown',
          postcode: '2560',
          status: 'Assigned'
        }
      ];
      
      for (const job of jobs) {
        const jobResult = await client.query(`
          INSERT INTO jobs (
            user_id, title, description, budget_min, budget_max,
            location, suburb, postcode, status, created_at
          )
          VALUES ($1, $2, $3, $4, $5, 'Sydney', $6, $7, $8, NOW())
          RETURNING id
        `, [customerId, job.title, job.description, job.budget_min, job.budget_max, job.suburb, job.postcode, job.status]);
        
        const jobId = jobResult.rows[0].id;
        
        await client.query(`
          INSERT INTO profile_unlocks (unlocked_by_user_id, unlocked_user_id, job_id, unlocked_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING
        `, [tradieId, customerId, jobId]);
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        message: 'Test data seeded successfully',
        tradie_id: tradieId,
        customer_id: customerId,
        jobs_created: jobs.length,
        credentials: {
          tradie: 'tradie@test.com / password123',
          customer: 'customer@test.com / password123'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({ 
      error: 'Seeding failed',
      details: error.message 
    });
  }
});

module.exports = router;
