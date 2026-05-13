// Seed test message threads for TradieTasker
// Run after users are seeded

const { v4: uuidv4 } = require('uuid');

async function seedTestMessages(pool) {
  console.log('Seeding test message threads...');

  try {
    // Get test users
    const usersResult = await pool.query('SELECT id, name, email, role FROM users LIMIT 5');
    const users = usersResult.rows;

    if (users.length < 2) {
      console.log('⚠ Not enough users to create message threads. Skipping.');
      return;
    }

    // Create 3 test threads
    const thread1 = uuidv4();
    const thread2 = uuidv4();
    const thread3 = uuidv4();

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Thread 1: Unread conversation about a plumbing job
    await pool.query(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES 
        ($1, $2, 'Plumbing job enquiry', 'Hi, I saw your plumbing job posting. I have 10 years experience and am available next week. Can we discuss the details?', $3, TRUE, $4),
        ($2, $1, 'Re: Plumbing job enquiry', 'Thanks for reaching out! The job involves fixing a leaking tap and checking the hot water system. When would suit you?', $3, TRUE, $5),
        ($1, $2, 'Re: Plumbing job enquiry', 'Tuesday or Wednesday morning would work best for me. I charge $85/hour + materials.', $3, FALSE, $6)
    `, [users[0].id, users[1].id, thread1, twoDaysAgo, yesterday, now]);

    // Thread 2: Read conversation about electrical work
    if (users.length >= 3) {
      await pool.query(`
        INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
        VALUES 
          ($1, $2, 'Electrical safety switch installation', 'I need a safety switch installed. Are you licensed for this type of work?', $3, TRUE, $4),
          ($2, $1, 'Re: Electrical safety switch installation', 'Yes, I am a licensed electrician. I can come out for a quote this week.', $3, TRUE, $5)
      `, [users[1].id, users[2].id, thread2, twoDaysAgo, yesterday]);
    }

    // Thread 3: Unread initial message
    if (users.length >= 4) {
      await pool.query(`
        INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
        VALUES 
          ($1, $2, 'Deck building quote', 'Hi, I am interested in building a new deck. Could you provide a quote? The area is approximately 4m x 6m.', $3, FALSE, $4)
      `, [users[3].id, users[0].id, thread3, now]);
    }

    console.log('✓ Test message threads created');
    console.log(`  - Thread 1: ${users[0].name} ↔ ${users[1].name} (3 messages, 1 unread)`);
    if (users.length >= 3) {
      console.log(`  - Thread 2: ${users[1].name} ↔ ${users[2].name} (2 messages, all read)`);
    }
    if (users.length >= 4) {
      console.log(`  - Thread 3: ${users[3].name} → ${users[0].name} (1 message, unread)`);
    }

  } catch (error) {
    console.error('Error seeding messages:', error.message);
    throw error;
  }
}

// If run directly
if (require.main === module) {
  const { Pool } = require('pg');
  require('dotenv').config();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  seedTestMessages(pool)
    .then(() => {
      console.log('✓ Seed complete');
      pool.end();
      process.exit(0);
    })
    .catch(error => {
      console.error('Seed failed:', error);
      pool.end();
      process.exit(1);
    });
}

module.exports = { seedTestMessages };
