# TradieTasker Messaging System

## Overview
Complete in-app messaging system for TradieTasker, allowing customers and tradies to communicate directly about jobs and services.

## Database Schema

### Messages Table
```sql
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  thread_id VARCHAR(36) NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, read);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

## API Endpoints

### GET /api/messages/threads
Get all message threads for the logged-in user.

**Headers:**
- `x-user-id`: Current user ID

**Response:**
```json
{
  "threads": [
    {
      "thread_id": "uuid",
      "subject": "Plumbing job enquiry",
      "last_message": "Message preview...",
      "last_message_at": "2026-05-13T00:00:00.000Z",
      "other_user_id": 123,
      "other_user_name": "John Smith",
      "unread_count": 2
    }
  ]
}
```

### GET /api/messages/thread/:threadId
Get all messages in a specific thread.

**Headers:**
- `x-user-id`: Current user ID

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "sender_id": 123,
      "recipient_id": 456,
      "sender_name": "John Smith",
      "recipient_name": "Jane Doe",
      "subject": "Plumbing job enquiry",
      "body": "Message content...",
      "read": true,
      "created_at": "2026-05-13T00:00:00.000Z"
    }
  ]
}
```

### POST /api/messages/send
Send a new message or reply to existing thread.

**Headers:**
- `x-user-id`: Current user ID

**Body:**
```json
{
  "recipient_id": 456,
  "subject": "Optional subject",
  "body": "Message content",
  "thread_id": "optional-existing-thread-id"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": 789,
  "thread_id": "uuid"
}
```

### PUT /api/messages/thread/:threadId/read
Mark all messages in a thread as read for the current user.

**Headers:**
- `x-user-id`: Current user ID

**Response:**
```json
{
  "success": true
}
```

### GET /api/messages/unread-count
Get unread message count for the current user.

**Headers:**
- `x-user-id`: Current user ID

**Response:**
```json
{
  "unread_count": 5
}
```

## Frontend Components

### InboxPage
- Location: `src/pages/InboxPage.tsx`
- Route: `/dashboard/inbox` and `/tradie-dashboard/inbox`
- Features:
  - List all message threads
  - Show sender name, last message preview, unread count, timestamp
  - Auto-refresh every 30 seconds
  - Click thread to open detail view

### MessageThreadView
- Location: `src/pages/MessageThreadView.tsx`
- Route: `/dashboard/inbox/thread/:threadId` and `/tradie-dashboard/inbox/thread/:threadId`
- Features:
  - Display all messages in thread
  - Reply form at bottom
  - Auto-mark messages as read when viewing
  - Auto-scroll to latest message
  - Auto-refresh every 30 seconds

### ComposeMessageModal
- Location: `src/components/ComposeMessageModal.tsx`
- Features:
  - Start new conversation
  - Select recipient (from unlocked profiles)
  - Optional subject field
  - Message body
  - Navigates to new thread on success

### MessageNotificationBadge
- Location: `src/components/MessageNotificationBadge.tsx`
- Features:
  - Envelope icon in navigation bar
  - Red badge with unread count
  - Auto-refresh every 30 seconds
  - Links to inbox page

## Deployment Steps

### 1. Apply Database Migration
```bash
cd ~/.openclaw/workspace/tradietasker-backend-fresh

# The migration will run automatically on server start
# Or run manually:
node -e "
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const sql = fs.readFileSync('./migrations/004_create_messages.sql', 'utf8');
  await pool.query(sql);
  console.log('✓ Messages table created');
  await pool.end();
}

migrate();
"
```

### 2. Seed Test Data (Optional)
```bash
node seeds/005_test_messages.js
```

### 3. Deploy Backend
```bash
git add .
git commit -m "Add messaging system"
git push origin main
```

Backend will auto-deploy on Railway.

### 4. Deploy Frontend
```bash
cd ~/.openclaw/workspace/tradietasker-v4-manual
npm run build
# Upload dist/ to hosting
```

## Testing Checklist

- [ ] Create database table (messages)
- [ ] Backend API endpoints working
  - [ ] GET /api/messages/threads
  - [ ] GET /api/messages/thread/:threadId
  - [ ] POST /api/messages/send
  - [ ] PUT /api/messages/thread/:threadId/read
  - [ ] GET /api/messages/unread-count
- [ ] Frontend pages render
  - [ ] InboxPage at /dashboard/inbox
  - [ ] MessageThreadView at /dashboard/inbox/thread/:id
- [ ] Message notification badge shows in header
- [ ] Send new message works
- [ ] Reply to message works
- [ ] Unread count updates correctly
- [ ] Mark as read works when viewing thread
- [ ] Auto-refresh works (30s interval)
- [ ] Test with multiple users

## Email Notifications (TODO)

Email notifications are currently commented out in the code. To implement:

1. Install nodemailer: `npm install nodemailer`
2. Configure email service (SMTP settings in .env)
3. Create email template
4. Uncomment and implement `sendEmailNotification()` in `/routes/messages.js`

Example notification email:
```
Subject: New message from [Sender Name] on TradieTasker

Hi [Recipient Name],

You have a new message from [Sender Name]:

"[Message preview...]"

View and reply: https://tradietasker.com.au/#/dashboard/inbox/thread/[thread_id]

- TradieTasker Team
```

## Future Enhancements

1. **Attachments**: Allow image/file attachments in messages
2. **Message search**: Search within messages
3. **Read receipts**: Show when recipient has read the message
4. **Typing indicators**: Show when other user is typing
5. **Push notifications**: Real-time browser notifications
6. **Email notifications**: Notify via email when new message arrives
7. **Message templates**: Pre-written message templates for common scenarios
8. **Archive threads**: Archive old conversations
9. **Block users**: Block unwanted messages
10. **Message reactions**: React to messages with emojis

## Security Notes

- Authentication required for all endpoints (x-user-id header)
- Users can only view threads they're part of
- Thread access verified before showing messages
- SQL injection protected via parameterized queries
- XSS protected via React's default escaping

## Performance Notes

- Indexes on thread_id, recipient_id, sender_id for fast queries
- Auto-refresh set to 30 seconds (configurable)
- Message history limited by thread (no global pagination yet)
- Consider pagination for threads list if user has 100+ threads

## Support

For issues or questions, contact the development team or refer to the main TradieTasker documentation.
