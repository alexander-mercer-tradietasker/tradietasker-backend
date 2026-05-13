const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = parseInt(userId);
  next();
};

// GET /api/messages/threads - Get all message threads for current user
router.get('/threads', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Get all threads where user is sender or recipient
    // Group by thread_id and get the latest message for each thread
    const threads = await query(`
      SELECT 
        m.thread_id,
        m.subject,
        m.body as last_message,
        m.created_at as last_message_at,
        CASE 
          WHEN m.sender_id = ? THEN m.recipient_id 
          ELSE m.sender_id 
        END as other_user_id,
        CASE 
          WHEN m.sender_id = ? THEN recipient.name 
          ELSE sender.name 
        END as other_user_name,
        (SELECT COUNT(*) 
         FROM messages 
         WHERE thread_id = m.thread_id 
           AND recipient_id = ? 
           AND read = false) as unread_count
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.id IN (
        SELECT MAX(id) 
        FROM messages 
        WHERE sender_id = ? OR recipient_id = ?
        GROUP BY thread_id
      )
      ORDER BY m.created_at DESC
    `, [userId, userId, userId, userId, userId]);

    res.json({ threads });
  } catch (error) {
    console.error('Error fetching message threads:', error);
    res.status(500).json({ error: 'Failed to fetch message threads' });
  }
});

// GET /api/messages/thread/:threadId - Get all messages in a thread
router.get('/thread/:threadId', requireAuth, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.userId;

    // Verify user is part of this thread
    const userMessages = await query(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE thread_id = ? AND (sender_id = ? OR recipient_id = ?)
    `, [threadId, userId, userId]);

    if (userMessages[0].count === 0) {
      return res.status(403).json({ error: 'Access denied to this thread' });
    }

    // Get all messages in thread
    const messages = await query(`
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.subject,
        m.body,
        m.read,
        m.created_at,
        sender.name as sender_name,
        sender.email as sender_email,
        recipient.name as recipient_name,
        recipient.email as recipient_email
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.thread_id = ?
      ORDER BY m.created_at ASC
    `, [threadId]);

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages/send - Send a new message
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { recipient_id, subject, body, thread_id } = req.body;
    const sender_id = req.userId;

    // Validate required fields
    if (!recipient_id || !body) {
      return res.status(400).json({ error: 'recipient_id and body are required' });
    }

    // Verify recipient exists
    const recipient = await get('SELECT id, name, email FROM users WHERE id = ?', [recipient_id]);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Verify sender exists
    const sender = await get('SELECT id, name, email FROM users WHERE id = ?', [sender_id]);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // Generate thread_id if not provided (new conversation)
    const finalThreadId = thread_id || uuidv4();

    // Insert message
    const result = await run(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, thread_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
    `, [sender_id, recipient_id, subject || '', body, finalThreadId]);

    const messageId = result.lastID;

    // TODO: Send email notification (implement later)
    // await sendEmailNotification(recipient, sender, body);

    res.status(201).json({
      success: true,
      message_id: messageId,
      thread_id: finalThreadId
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/messages/thread/:threadId/read - Mark all messages in thread as read
router.put('/thread/:threadId/read', requireAuth, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.userId;

    // Mark all messages in thread as read for current user (as recipient)
    await run(`
      UPDATE messages
      SET read = true
      WHERE thread_id = ? AND recipient_id = ? AND read = false
    `, [threadId, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// GET /api/messages/unread-count - Get unread message count for current user
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await get(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE recipient_id = ? AND read = false
    `, [userId]);

    res.json({ unread_count: result.count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
