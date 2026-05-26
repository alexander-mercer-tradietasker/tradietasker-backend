const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Seed database endpoint
router.post('/seed', async (req, res) => {
    // Basic admin authorization check
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer SecureAdmin2026!') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://tradietasker_db_user:T0ZsNNEiWpjmjvZ31P6wmnsKbJcimoV7@dpg-d84q5dh9rddc739q9gp0-a/tradietasker_db'
    });

    try {
        // Customers
        const customerEmails = [
            'john.customer@tradietasker.com.au',
            'sarah.customer@tradietasker.com.au',
            'emma.customer@tradietasker.com.au',
            'michael.customer@tradietasker.com.au',
            'lisa.customer@tradietasker.com.au',
            'james.customer@tradietasker.com.au',
            'sophie.customer@tradietasker.com.au',
            'robert.customer@tradietasker.com.au',
            'olivia.customer@tradietasker.com.au',
            'isabella.customer@tradietasker.com.au'
        ];

        // Tradies
        const tradieEmails = [
            'mark.tradie@tradietasker.com.au',
            'alex.tradie@tradietasker.com.au',
            'chris.tradie@tradietasker.com.au',
            'sam.tradie@tradietasker.com.au',
            'jordan.tradie@tradietasker.com.au',
            'taylor.tradie@tradietasker.com.au',
            'casey.tradie@tradietasker.com.au',
            'drew.tradie@tradietasker.com.au',
            'riley.tradie@tradietasker.com.au',
            'nicole.tradie@tradietasker.com.au'
        ];

        // Hash password
        const hashedPassword = await bcrypt.hash('P@55w0rd@g3^', 10);

        // Seed Customers
        for (const email of customerEmails) {
            const firstName = email.split('.')[0];
            const lastName = 'Customer';
            await pool.query(
                'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
                [email, hashedPassword, firstName, lastName, 'customer']
            );
        }

        // Seed Tradies
        for (const email of tradieEmails) {
            const firstName = email.split('.')[0];
            const lastName = 'Tradie';
            await pool.query(
                'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
                [email, hashedPassword, firstName, lastName, 'tradie']
            );
        }

        // Seed Admin
        const adminPassword = await bcrypt.hash('SecureAdmin2026!', 10);
        await pool.query(
            'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
            ['admin', adminPassword, 'Admin', 'User', 'admin']
        );

        await pool.end();
        
        res.status(200).json({ 
            message: 'Database seeding completed successfully',
            seededUsers: {
                customers: customerEmails.length,
                tradies: tradieEmails.length,
                admins: 1
            }
        });
    } catch (error) {
        console.error('Error seeding database:', error);
        res.status(500).json({ 
            error: 'Failed to seed database', 
            details: error.message 
        });
    }
});

module.exports = router;