# TradieTasker Backend - Phase 1 Complete

## Overview

This directory contains the **Phase 1: Database Schema Implementation** for the TradieTasker rebuild.

## What Was Built

### 1. Database Schema (`db/schema.sql`)
Complete SQLite database schema including:
- **Updated `users` table**: Added 20+ new fields for business info, service area, tier, and credits
- **Updated `jobs` table**: Added 8 new fields for job types, descriptions, status workflow, and god-tier functionality
- **9 New Tables**:
  - `professions` - 70 professions categorized into 6 categories
  - `job_types` - 100 job types categorized into 3 categories
  - `user_professions` - Many-to-many relationship for tasker professions
  - `user_job_types` - Many-to-many relationship for jobs taskers will do
  - `user_qualifications` - TAFE, university, and other qualifications
  - `subscriptions` - Tasker subscription management
  - `contact_transactions` - Credit usage tracking
  - `reviews` - Job review system
  - `poster_packages` - 3-tradie and 20-tradie packages for posters

### 2. Migration Script (`migrations/001_phase1_schema_updates.sql`)
- Alters existing tables to add new columns
- Creates all new tables
- Adds performance indexes
- Safe to run on existing database (uses `IF NOT EXISTS` and handles duplicate column errors)

### 3. Seed Data
- `seeds/002_professions_seed.sql` - 70 professions from PROFESSIONS_ANALYSIS.md
  - Core trades (16)
  - Specialised construction (20)
  - Building-adjacent trades (14)
  - Property maintenance (14)
  - Home services (4)
  - Transport & delivery (5)
  
- `seeds/003_job_types_seed.sql` - 100 job types
  - Building & construction (69)
  - Property maintenance & garden (23)
  - Transport & delivery (8)

### 4. Migration Tool (`migrate.js`)
Node.js script that:
- Applies migration SQL files
- Applies seed data
- Provides colored console output
- Verifies completion with counts
- Handles errors gracefully

### 5. Test Script (`test-schema.js`)
Comprehensive testing that verifies:
- All 12 tables exist
- New user columns are present
- New job columns are present
- Seed data is correct (70 professions, 100 job types)
- Sample queries work correctly

## Installation

```bash
cd /home/michael/.openclaw/workspace/tradietasker/backend
npm install
```

## Usage

### Run Migration (creates/updates database)
```bash
npm run migrate
```

Or specify a database path:
```bash
node migrate.js /path/to/database.db
```

### Test Schema
```bash
npm test
```

### Production Deployment (Railway)
```bash
npm run migrate:prod
```

## Database Schema Summary

### Users Table Fields
**Existing**: id, name, email, password, role, created_at, updated_at

**New**: 
- Personal: date_of_birth, phone, residential_*, postal_*
- Business: abn, business_name, business_address, business_phone, business_email, business_logo_url, profile_photo_url
- Service: service_radius_km, service_postcode
- Subscription: tier (free/bronze/silver/gold/platinum/god), credits

### Jobs Table Fields
**Existing**: id, poster_id, poster_name, title, category, description, location, budget, created_at, updated_at

**New**:
- job_type_id (links to job_types table)
- short_description (visible to paid tiers)
- full_description (visible after full contact)
- photos (JSON array)
- status (open/awarded/in-progress/complete/cancelled)
- awarded_to_user_id
- completed_at
- is_god_tier (boolean)

## Data Relationships

```
users
├─ user_professions → professions
├─ user_job_types → job_types
├─ user_qualifications
├─ subscriptions
├─ jobs (as poster)
├─ applications (as tradie)
├─ contact_transactions (from/to)
├─ reviews (as reviewer/reviewee)
└─ poster_packages

jobs
├─ job_type_id → job_types
├─ applications
├─ contact_transactions
├─ reviews
└─ poster_packages
```

## Profession Categories

1. **core-trades** - Licensed building trades (architect, electrician, plumber, etc.)
2. **specialised** - Specialised construction (asbestos removal, pool builder, surveyor, etc.)
3. **adjacent** - Building-adjacent (HVAC, locksmith, handyman, etc.)
4. **maintenance** - Property maintenance (cleaner, gardener, pest control, etc.)
5. **home-services** - Home services (furniture assembler, interior designer, removalist)
6. **transport** - Transport & delivery (courier, delivery driver, etc.)

## Job Type Categories

1. **building-construction** - Building and construction jobs (69 types)
2. **maintenance-garden** - Property maintenance and garden jobs (23 types)
3. **transport-delivery** - Transport and delivery jobs (8 types)

## Indexes

Performance indexes created on:
- users: email, role, tier
- professions: category
- job_types: category
- jobs: status, poster_id, job_type_id, is_god_tier
- applications: job_id, tradie_id, status
- contact_transactions: from_user_id, to_user_id, job_id
- reviews: job_id, reviewee_id
- subscriptions: user_id, is_active
- And more...

## Next Steps (Phase 2)

With Phase 1 complete, proceed to:

1. **Backend API Updates**:
   - Create new endpoints for professions, job types, subscriptions
   - Update job posting to use job_type_id
   - Implement credit system
   - Add tier-based job visibility
   - Build contact transaction system
   - Implement review system

2. **Frontend Updates**:
   - New tasker sign-up flow (7 steps)
   - Browse jobs with tier visibility
   - Browse taskers with limited info
   - Contact purchase modals
   - Subscription management

3. **Stripe Integration**:
   - Subscription checkout
   - Credit purchases
   - Poster packages

## Files

```
backend/
├── db/
│   ├── schema.sql           # Complete schema (for new databases)
│   └── tradietasker.db      # SQLite database (created by migration)
├── migrations/
│   └── 001_phase1_schema_updates.sql  # Phase 1 migration
├── seeds/
│   ├── 002_professions_seed.sql      # 70 professions
│   └── 003_job_types_seed.sql        # 100 job types
├── migrate.js               # Migration runner
├── test-schema.js          # Schema verification tests
├── package.json            # Node.js dependencies
└── README.md              # This file
```

## Notes

- SQLite database will be created at `./db/tradietasker.db` by default
- Migration is idempotent (safe to run multiple times)
- All foreign keys use `ON DELETE CASCADE` for clean data removal
- Uses `INSERT OR IGNORE` for seed data (prevents duplicates)
- Compatible with existing Railway deployment

## Testing

After migration, verify:
1. ✅ All 12 tables exist
2. ✅ 70 professions seeded
3. ✅ 100 job types seeded
4. ✅ New user columns exist
5. ✅ New job columns exist
6. ✅ Sample queries work

Run `npm test` to verify all of the above.

---

**Phase 1 Status**: ✅ Complete  
**Created**: 2026-05-08  
**Ready for Phase 2**: Backend API Development
