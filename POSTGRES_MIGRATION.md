# PostgreSQL Migration Guide

This guide covers the migration from SQLite to PostgreSQL for persistent data storage on Railway.

## What Changed

1. **Database Driver**: Added `pg` (node-postgres) package alongside sqlite3
2. **Connection Module**: Updated `db/connection.js` to support both PostgreSQL and SQLite
3. **Schema**: Created PostgreSQL-compatible schema in `db/schema-postgres.sql`
4. **Migration Script**: Added `migrate-postgres.js` for PostgreSQL setup

## How It Works

The backend now automatically detects which database to use:
- **PostgreSQL**: Used when `DATABASE_URL` environment variable is set
- **SQLite**: Falls back to SQLite for local development when no `DATABASE_URL`

## Railway Setup

### Step 1: Add PostgreSQL Plugin

1. Log into Railway dashboard
2. Open your project: `successful-balance`
3. Click "New" → "Database" → "Add PostgreSQL"
4. Railway will automatically:
   - Provision a PostgreSQL database
   - Set the `DATABASE_URL` environment variable
   - Connect it to your service

### Step 2: Run Migration

The migration will run automatically on the next deploy because Railway will detect `DATABASE_URL`.

**OR** you can manually run it:

```bash
# Get DATABASE_URL from Railway dashboard
# Variables tab → PostgreSQL → DATABASE_URL

# Run migration locally (testing)
DATABASE_URL="your-postgres-url" npm run migrate:postgres

# Or on Railway
# Add a one-time deployment command in Railway settings:
npm run migrate:postgres && npm start
```

### Step 3: Verify

After deployment, test these endpoints:

```bash
# Health check
curl https://web-production-b8901.up.railway.app/health

# Register a test user
curl -X POST https://web-production-b8901.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User"
  }'

# Redeploy and verify user persists
curl -X POST https://web-production-b8901.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

## Key Changes in Code

### Connection Module (`db/connection.js`)

- Detects PostgreSQL via `DATABASE_URL`
- Auto-converts `?` placeholders to PostgreSQL `$1, $2, $3`
- Returns consistent API for both databases
- Handles `RETURNING id` for INSERT operations

### Schema Conversion

SQLite → PostgreSQL conversions:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `BOOLEAN DEFAULT 0` → `BOOLEAN DEFAULT FALSE`
- `BOOLEAN DEFAULT 1` → `BOOLEAN DEFAULT TRUE`
- `datetime('now')` → `CURRENT_TIMESTAMP` (handled by schema defaults)

### Known Issues & Fixes Needed

Some route files still use SQLite-specific syntax:
- `datetime('now')` in INSERT/UPDATE statements
- These work because schemas have DEFAULT CURRENT_TIMESTAMP
- But should be cleaned up for clarity

To fix completely, search and remove explicit datetime calls:
```bash
grep -r "datetime('now')" routes/
```

## Local Development

Continue using SQLite for local development:

```bash
# No DATABASE_URL = uses SQLite
npm run init      # Create fresh SQLite database
npm run migrate   # Apply migrations to SQLite
npm run dev       # Start with SQLite
```

## Environment Variables

```bash
# Local (.env)
NODE_ENV=development
JWT_SECRET=your-secret
PORT=3001

# Railway (set in dashboard)
DATABASE_URL=postgres://user:pass@host:5432/railway  # Auto-set by Railway
NODE_ENV=production
JWT_SECRET=your-production-secret
PORT=3001  # Optional, Railway auto-assigns
```

## Troubleshooting

### Connection Errors

If you see "connection refused":
1. Check `DATABASE_URL` is set correctly
2. Verify PostgreSQL plugin is running
3. Check Railway logs for database errors

### Migration Fails

If migration script fails:
1. Check schema syntax
2. Verify seed files are PostgreSQL-compatible
3. Check Railway database connection limits

### Data Not Persisting

1. Verify `DATABASE_URL` is set in Railway
2. Check app is not recreating SQLite database
3. Review logs for database connection info

## Migration Checklist

- [x] Install `pg` package
- [x] Create PostgreSQL-compatible connection module
- [x] Create PostgreSQL schema file
- [x] Create migration script
- [ ] Add PostgreSQL plugin to Railway project
- [ ] Deploy to Railway
- [ ] Run migration script
- [ ] Test user registration
- [ ] Test data persistence after redeploy
- [ ] Clean up datetime('now') in route files (optional)

## Rollback Plan

If PostgreSQL migration fails:
1. Remove `DATABASE_URL` from Railway environment
2. Redeploy (will fall back to SQLite)
3. Review logs and fix issues
4. Try migration again

Note: SQLite will be ephemeral on Railway, so only use for emergency rollback.
