const { run } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

async function seedMessages() {
  try {
    console.log('Seeding test messages...');

    // Create 3 message threads as requested

    // Thread 1: Test Customer (1) <-> Test Tradie (2)
    const thread1 = uuidv4();
    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
    `, [1, 2, 'Plumbing Job Enquiry', 'Hi, I need a plumber to fix a leaking tap. Are you available this week?', thread1, true]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days', '+2 hours'))
    `, [2, 1, 'Plumbing Job Enquiry', 'Yes, I can help with that. I have availability on Thursday afternoon. Would that work for you?', thread1, true]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 days'))
    `, [1, 2, 'Plumbing Job Enquiry', 'Thursday afternoon works great! See you then.', thread1, false]);

    console.log('✓ Thread 1 created: Customer <-> Tradie (Plumbing)');

    // Thread 2: Test Customer (1) <-> Test Tradie (7)
    const thread2 = uuidv4();
    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))
    `, [1, 7, 'Electrical Work Quote', 'I need an electrician to install some outdoor lighting. Can you provide a quote?', thread2, true]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 days', '+1 hour'))
    `, [7, 1, 'Electrical Work Quote', 'Sure! Could you send me some photos of the area and let me know how many lights you need?', thread2, true]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days', '+8 hours'))
    `, [1, 7, 'Electrical Work Quote', 'Here are the photos. I need 4 lights installed along the pathway and 2 near the garage.', thread2, false]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-6 hours'))
    `, [7, 1, 'Electrical Work Quote', 'Thanks! Based on the photos, I can provide a quote of $850 including materials and labour. Let me know if you want to proceed.', thread2, false]);

    console.log('✓ Thread 2 created: Customer <-> Tradie (Electrical)');

    // Thread 3: Another Customer (9) <-> Test Tradie (2)
    const thread3 = uuidv4();
    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-5 days'))
    `, [9, 2, 'Kitchen Renovation', 'I saw your profile and would like to discuss a kitchen renovation project. Are you taking on new projects?', thread3, true]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-5 days', '+4 hours'))
    `, [2, 9, 'Kitchen Renovation', 'Yes, I am available for new projects. When would be a good time to inspect the site and discuss your requirements?', thread3, true]);

    await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-4 days'))
    `, [9, 2, 'Kitchen Renovation', 'Great! How about next Monday morning around 10 AM?', thread3, false]);

    console.log('✓ Thread 3 created: Another Customer <-> Tradie (Kitchen Reno)');

    console.log('\n✅ Test messages seeded successfully!');
    console.log('Summary:');
    console.log('  - 3 message threads created');
    console.log('  - 10 total messages');
    console.log('  - Mix of read and unread messages');

  } catch (error) {
    console.error('❌ Error seeding messages:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedMessages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedMessages };
