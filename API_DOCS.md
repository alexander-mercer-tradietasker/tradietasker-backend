# TradieTasker API Documentation

**Version:** 2.1.0  
**Base URL:** `http://localhost:3001` (development) or `https://web-production-b8901.up.railway.app` (production)

---

## Authentication

Most endpoints require authentication via JWT token.

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Getting a Token
1. Register via `POST /api/auth/register`
2. Login via `POST /api/auth/login`
3. Both return a `token` field in the response

---

## Endpoints

### Health Check

#### `GET /health`
Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-08T14:00:00.000Z"
}
```

---

## Authentication Endpoints

### `POST /api/auth/register`
Register a new user (poster or tasker).

**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "0412345678",
  "role": "tasker"  // "poster", "tasker", or "both" (default: "poster")
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "role": "tasker",
    "tier": "free",
    "credits": 0
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### `POST /api/auth/login`
Login with email and password.

**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## User Endpoints

### `GET /api/users/me`
Get current user profile with professions, job types, qualifications, and subscription.

**Auth:** Required

**Response:**
```json
{
  "id": 1,
  "email": "john@example.com",
  "name": "John Doe",
  "tier": "silver",
  "credits": 15,
  "professions": [
    {
      "id": 1,
      "name": "Electrician",
      "category": "core-trades",
      "licence_number": "NSW123456",
      "state": "NSW"
    }
  ],
  "jobTypes": [...],
  "qualifications": [...],
  "subscription": {...}
}
```

### `PUT /api/users/me`
Update user profile.

**Auth:** Required

**Body:** (all fields optional)
```json
{
  "name": "John Doe",
  "phone": "0412345678",
  "residential_address": "123 Main St",
  "residential_suburb": "Sydney",
  "residential_state": "NSW",
  "residential_postcode": "2000",
  "abn": "12345678901",
  "business_name": "John's Electrical",
  "service_radius_km": 50,
  "service_postcode": "2000"
}
```

### `POST /api/users/me/abn-lookup`
Lookup ABN from Australian Business Register (not yet integrated with ABR API).

**Auth:** Required

**Body:**
```json
{
  "abn": "12345678901"
}
```

### `POST /api/users/me/professions`
Add a profession to tasker profile.

**Auth:** Required

**Body:**
```json
{
  "profession_id": 1,
  "licence_number": "NSW123456",
  "state": "NSW"
}
```

### `DELETE /api/users/me/professions/:id`
Remove a profession.

**Auth:** Required

### `POST /api/users/me/job-types`
Add job types tasker is willing to do.

**Auth:** Required

**Body:**
```json
{
  "job_type_id": 5
}
```

### `POST /api/users/me/qualifications`
Add a qualification.

**Auth:** Required

**Body:**
```json
{
  "type": "tafe",  // "tafe", "university", or "other"
  "name": "Certificate III in Electrical",
  "year_obtained": 2018
}
```

---

## Professions & Job Types

### `GET /api/professions`
List all professions.

**Query params:**
- `category` (optional): Filter by category

**Response:**
```json
{
  "professions": [
    {
      "id": 1,
      "name": "Electrician",
      "category": "core-trades",
      "requires_licence": true
    }
  ]
}
```

### `GET /api/professions/categories`
List profession categories.

### `GET /api/job-types`
List all job types.

**Query params:**
- `category` (optional): Filter by category

### `GET /api/job-types/categories`
List job type categories.

---

## Subscriptions & Credits

### `GET /api/subscriptions/tiers`
List subscription tiers and pricing.

**Response:**
```json
{
  "tiers": {
    "free": {
      "name": "Free",
      "price_per_week": 0,
      "credits_included": 0,
      "early_access_hours": 24,
      "discount_percent": 0
    },
    "bronze": { ... },
    "silver": { ... },
    "gold": { ... },
    "platinum": { ... }
  }
}
```

### `GET /api/subscriptions/my-subscription`
Get current subscription.

**Auth:** Required

### `POST /api/subscriptions/subscribe`
Subscribe to a tier.

**Auth:** Required

**Body:**
```json
{
  "tier": "silver"  // "bronze", "silver", "gold", or "platinum"
}
```

### `PUT /api/subscriptions/change-tier`
Upgrade or downgrade tier.

**Auth:** Required

**Body:**
```json
{
  "tier": "gold"
}
```

### `POST /api/subscriptions/cancel`
Cancel subscription (downgrade to free).

**Auth:** Required

### `GET /api/credits/balance`
Get current credit balance and available packages.

**Auth:** Required

### `POST /api/credits/purchase`
Buy one-off credit pack.

**Auth:** Required

**Body:**
```json
{
  "package": "medium"  // "small" (5 credits/$5), "medium" (10/$9), "large" (20/$16), "xlarge" (50/$35)
}
```

---

## Jobs

### `GET /api/jobs`
Browse jobs (tier-based visibility).

**Auth:** Optional (shows more with auth + higher tier)

**Query params:**
- `postcode` (optional)
- `radius_km` (optional, default: 25)
- `profession_id` (optional)
- `job_type_id` (optional)
- `status` (optional, default: "open")
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "Electrical work needed",
      "short_description": "Need electrician for...",
      "budget": 500,
      "postcode": "2000",
      "suburb": "Sydney",
      "state": "NSW",
      "job_type_name": "Electrical Installation",
      "poster_name": "Jane Smith"
    }
  ],
  "count": 10,
  "userTier": "silver",
  "earlyAccessHours": 2
}
```

**Tier-based visibility:**
- **Free:** Jobs older than 24 hours
- **Bronze:** Jobs older than 3 hours
- **Silver:** Jobs older than 2 hours
- **Gold:** Jobs older than 1 hour
- **Platinum/God:** All jobs immediately

### `POST /api/jobs`
Post a job. Creates account if poster doesn't have one.

**Auth:** Optional (will create account if not logged in)

**Body:**
```json
{
  "title": "Electrical work needed",
  "short_description": "Need electrician for outlet installation",
  "full_description": "I need an electrician to install 3 new power outlets...",
  "budget": 500,
  "postcode": "2000",
  "suburb": "Sydney",
  "state": "NSW",
  "job_type_id": 5,
  "photos": ["url1", "url2"],
  
  // If not logged in, include these:
  "email": "jane@example.com",
  "password": "password123",
  "name": "Jane Smith",
  "phone": "0498765432"
}
```

**Response (201):**
```json
{
  "message": "Job posted successfully",
  "job": { ... },
  "token": "..." // If account was created
}
```

### `GET /api/jobs/:id`
Get job details (full details if owner/contacted/god).

**Auth:** Optional

### `PUT /api/jobs/:id/status`
Update job status (owner only).

**Auth:** Required

**Body:**
```json
{
  "status": "awarded"  // "open", "awarded", "in-progress", "complete", "cancelled"
}
```

### `POST /api/jobs/:id/award`
Award job to a tasker (owner only).

**Auth:** Required

**Body:**
```json
{
  "tasker_id": 3
}
```

---

## Contact System

### `POST /api/contact/send-profile`
Tasker sends profile to poster (**Tradie Unlock** - 1 credit).

**Auth:** Required

**Body:**
```json
{
  "job_id": 5
}
```

**Response:**
```json
{
  "message": "Profile sent to poster successfully",
  "credits_used": 1,
  "credits_remaining": 14
}
```

### `POST /api/contact/full-contact`
Tasker gets full job details (**Task Unlock** - 2 credits).

**Auth:** Required

**Body:**
```json
{
  "job_id": 5
}
```

**Response:**
```json
{
  "message": "Full contact unlocked successfully",
  "credits_used": 2,
  "credits_remaining": 12,
  "job": {
    "id": 5,
    "title": "...",
    "full_description": "...",
    "poster_email": "poster@example.com",
    "poster_phone": "0412345678",
    "photos": [...]
  }
}
```

### `POST /api/contact/unlock-tradie`
Poster unlocks single tradie from browse (1 credit).

**Auth:** Required

**Body:**
```json
{
  "tasker_id": 3,
  "job_id": 5
}
```

### `POST /api/contact/3-tradie-pack`
Poster buys **3-Tradie Unlock Starter Pack** ($5.50).

**Auth:** Required

**Body:**
```json
{
  "job_id": 5
}
```

### `POST /api/contact/20-tradie-pack`
Poster buys **20-Tradie Unlock Pro Pack** ($22).

**Auth:** Required

**Body:**
```json
{
  "job_id": 5
}
```

### `GET /api/contact/my-contacts`
List all contacts unlocked.

**Auth:** Required

---

## Tasker Profiles

### `GET /api/taskers`
Browse tasker profiles.

**Auth:** Optional

**Query params:**
- `profession_id` (optional)
- `postcode` (optional)
- `radius_km` (optional, default: 25)
- `min_rating` (optional)
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "taskers": [
    {
      "id": 3,
      "name": "John Doe",
      "tier": "silver",
      "service_postcode": "2000",
      "service_radius_km": 25,
      "business_name": "John's Electrical",
      "review_count": 12,
      "avg_rating": "4.8",
      "professions": ["Electrician", "Air Conditioning"],
      "is_unlocked": false
    }
  ],
  "count": 10
}
```

### `GET /api/taskers/:id`
Get detailed tasker profile (full details if unlocked/god).

**Auth:** Optional

---

## Reviews

### `POST /api/reviews`
Leave a review (awards 1 credit to both reviewer and reviewee).

**Auth:** Required

**Body:**
```json
{
  "job_id": 5,
  "reviewee_id": 3,
  "stars": 5,
  "comment": "Great work, very professional!"
}
```

**Response:**
```json
{
  "message": "Review submitted successfully",
  "credits_awarded": 1,
  "message_extra": "Both you and the reviewee received 1 credit"
}
```

### `GET /api/reviews/job/:jobId`
Get all reviews for a job.

### `GET /api/reviews/user/:userId`
Get all reviews for a user, with rating stats.

**Response:**
```json
{
  "reviews": [...],
  "stats": {
    "review_count": 12,
    "avg_rating": "4.8",
    "five_star": 10,
    "four_star": 2,
    "three_star": 0,
    "two_star": 0,
    "one_star": 0
  }
}
```

---

## Admin Endpoints (God Tier Only)

All admin endpoints require god tier authentication.

### `GET /api/admin/stats`
Platform statistics.

**Auth:** Required (god tier)

**Response:**
```json
{
  "stats": {
    "poster_count": 50,
    "tasker_count": 100,
    "both_count": 20,
    "total_jobs": 200,
    "open_jobs": 45,
    "completed_jobs": 120,
    "total_credits_spent": 450,
    "total_reviews": 80,
    "platform_avg_rating": "4.6"
  },
  "tierDistribution": [...],
  "topTaskers": [...],
  "topProfessions": [...],
  "jobTypeDemand": [...]
}
```

### `POST /api/admin/users/:id/set-tier`
Manually set user tier.

**Auth:** Required (god tier)

**Body:**
```json
{
  "tier": "platinum"
}
```

### `POST /api/admin/jobs/:id/god-tier`
Mark job as god-tier only (only visible to god users).

**Auth:** Required (god tier)

**Body:**
```json
{
  "is_god_tier": true
}
```

### `GET /api/admin/users`
List all users with filters.

**Auth:** Required (god tier)

**Query params:**
- `role` (optional)
- `tier` (optional)
- `limit` (optional, default: 100)
- `offset` (optional, default: 0)

### `GET /api/admin/jobs`
List all jobs with filters.

**Auth:** Required (god tier)

**Query params:**
- `status` (optional)
- `is_god_tier` (optional)
- `limit` (optional, default: 100)
- `offset` (optional, default: 0)

### `POST /api/admin/users/:id/credits`
Manually adjust user credits.

**Auth:** Required (god tier)

**Body:**
```json
{
  "amount": 10  // Can be positive or negative
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `402` - Payment Required (insufficient credits)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (already exists)
- `500` - Internal Server Error

---

## Business Logic Summary

### Tier-Based Early Access
- **Free:** 24-hour delay
- **Bronze:** 3-hour delay (5 credits/week, $25/week)
- **Silver:** 2-hour delay (10 credits/week, $45/week, 10% discount)
- **Gold:** 1-hour delay (20 credits/week, $65/week, 15% discount)
- **Platinum:** Instant access (40 credits/week, $100/week, 20% discount)
- **God:** Admin tier (instant access, unlimited credits)

### Contact Credit Costs
- **Tradie Unlock** (tasker sends profile): 1 credit
- **Task Unlock** (tasker gets full job details): 2 credits
- **Poster Unlock Tradie** (single): 1 credit
- **3-Tradie Unlock Starter Pack**: $5.50 (unlock 3 tradies for one job)
- **20-Tradie Unlock Pro Pack**: $22 (unlock 20 tradies for one job)

### Review Credits
- Both reviewer and reviewee receive 1 credit when a review is submitted

### Credit Packages (One-off)
- **Small:** 5 credits for $5
- **Medium:** 10 credits for $9
- **Large:** 20 credits for $16
- **XLarge:** 50 credits for $35

---

## TODO: Stripe Integration

Payment endpoints currently return mock success responses. Stripe integration pending for:
- Subscription payments (`/api/subscriptions/subscribe`, `/api/subscriptions/change-tier`)
- Credit purchases (`/api/credits/purchase`)
- Poster packages (`/api/contact/3-tradie-pack`, `/api/contact/20-tradie-pack`)

---

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

3. Initialize database:
   ```bash
   npm run init
   ```

4. Run migrations:
   ```bash
   npm run migrate
   ```

5. Start server:
   ```bash
   npm start
   ```

6. Development mode (with auto-reload):
   ```bash
   npm run dev
   ```

---

**Phase 2 Complete!** All 40+ endpoints implemented with business logic, tier-based access, credit system, and god-tier admin panel.
