# TradieTasker Backend - Local Development Setup

## Database: PostgreSQL ONLY

**CRITICAL:** This project uses PostgreSQL for both local development AND production.
SQLite fallback exists in code but should NEVER be used.

### Local PostgreSQL Connection

The `.env` file (git-ignored) contains:

```
DATABASE_URL=postgresql://tradietasker:tradietasker_dev@localhost:5432/tradietasker
```

**Never modify or delete this line.** The backend connection layer (`db/connection.js`) checks for `DATABASE_URL` and uses PostgreSQL when present.

### Why No SQLite?

- Schema differences cause bugs (syntax, types, constraints)
- Production uses PostgreSQL - local MUST match
- Debugging database-specific issues wastes time

### Verify Connection

```bash
cd ~/tradietasker-backend-deploy
node -e "require('dotenv').config(); require('./db/connection').query('SELECT 1').then(() => console.log('✓ PostgreSQL connected')).catch(e => console.error('✗ Connection failed:', e));"
```

### Running Migrations

All migration scripts automatically load `.env`:

```bash
node run-migration-001.js
```

### Old SQLite Database

The file `db/tradietasker.db` is outdated and should be ignored. Archived SQLite scripts live in `backend/archive/sqlite-old/` for historical reference only.
