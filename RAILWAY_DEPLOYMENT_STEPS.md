# Railway Deployment Steps - PostgreSQL Migration

## Status: Ready to Deploy ✅

All code changes for PostgreSQL support are complete and committed locally.

## What Was Done

✅ Installed `pg` (node-postgres) package  
✅ Created dual-mode database connection (PostgreSQL/SQLite)  
✅ Created PostgreSQL-compatible schema  
✅ Created PostgreSQL migration script  
✅ Updated routes to be database-agnostic  
✅ Committed changes to local git repository  

## Next Steps

### 1. Push to GitHub

**Note:** GitHub requires a Personal Access Token (PAT) instead of password authentication.

Option A: Use GitHub CLI (recommended):
```bash
cd /home/michael/.openclaw/workspace/shared-live/tradietasker-backend
gh auth login
git push origin master
```

Option B: Generate a PAT and update remote URL:
1. Go to https://github.com/settings/tokens
2. Generate new token (classic) with `repo` scope
3. Update remote URL:
```bash
git remote set-url origin https://alexander-mercer-au:YOUR_TOKEN_HERE@github.com/alexander-mercer-au/tradietasker-backend.git
git push origin master
```

### 2. Add PostgreSQL to Railway

1. **Log into Railway Dashboard**
   - Visit https://railway.app
   - Navigate to your project: `successful-balance`
   - Find service: `web`

2. **Add PostgreSQL Plugin**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically:
     - Provision a PostgreSQL database
     - Create `DATABASE_URL` environment variable
     - Link it to your service

3. **Wait for Auto-Deploy**
   - Railway will detect the GitHub push
   - It will automatically redeploy your service
   - The backend will detect `DATABASE_URL` and use PostgreSQL

### 3. Run Migration

Option A: Railway will run the migration on first startup (if you add it to start script)

Option B: Run manually via Railway CLI:
```bash
railway run npm run migrate:postgres
```

Option C: Add a one-time deployment command in Railway dashboard:
- Go to Settings → Deploy
- Add build command: `npm run migrate:postgres && npm start`
- After successful deploy, remove it and use normal start

### 4. Test the Deployment

```bash
# Health check
curl https://web-production-b8901.up.railway.app/health

# Register test user
curl -X POST https://web-production-b8901.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "name": "Test User"
  }'

# Verify credentials were saved (login)
curl -X POST https://web-production-b8901.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### 5. Test Data Persistence

1. Note the user ID from the registration response
2. Trigger a redeploy in Railway (or wait for next automatic deploy)
3. Try logging in again with the same credentials
4. ✅ If login succeeds, data is persisting!

## Verification Checklist

- [ ] Code pushed to GitHub successfully
- [ ] PostgreSQL plugin added to Railway project
- [ ] `DATABASE_URL` environment variable is set
- [ ] Backend redeployed and running
- [ ] Migration script ran successfully
- [ ] Health endpoint returns 200 OK
- [ ] Can register a new user
- [ ] Can login with registered user
- [ ] User data persists after redeploy

## Troubleshooting

### Can't Push to GitHub
- Check PAT has correct permissions
- Verify remote URL is correct
- Try `gh auth login` if using GitHub CLI

### Railway Deploy Fails
- Check Railway logs for errors
- Verify package.json has correct start script
- Ensure DATABASE_URL is set

### Migration Fails
- Check schema syntax errors
- Verify seed files are compatible
- Check Railway database connection

### Data Not Persisting
- Confirm DATABASE_URL is set (not using SQLite)
- Check logs for "Connected to PostgreSQL database"
- Verify no errors during migration

## Support Files

- **Migration Guide:** `POSTGRES_MIGRATION.md` - Comprehensive technical guide
- **Schema:** `db/schema-postgres.sql` - PostgreSQL-compatible schema
- **Migration Script:** `migrate-postgres.js` - Automated migration tool
- **Connection Module:** `db/connection.js` - Dual-mode database connection

## Current Deployment Info

- **Railway Project:** successful-balance
- **Service Name:** web
- **Production URL:** https://web-production-b8901.up.railway.app
- **GitHub Repo:** alexander-mercer-au/tradietasker-backend
- **Branch:** master

---

**Status:** Ready for Railway deployment. All code changes are complete and committed.
