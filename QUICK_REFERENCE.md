# TradieTasker Database Quick Reference

## Common Queries

### Get all professions by category
```sql
SELECT id, name, requires_licence 
FROM professions 
WHERE category = 'core-trades'
ORDER BY name;
```

### Get all job types by category
```sql
SELECT id, name 
FROM job_types 
WHERE category = 'building-construction'
ORDER BY name;
```

### Get user's professions with licence info
```sql
SELECT p.name, up.licence_number, up.state
FROM user_professions up
JOIN professions p ON up.profession_id = p.id
WHERE up.user_id = ?
ORDER BY p.name;
```

### Get user's job types
```sql
SELECT jt.name, jt.category
FROM user_job_types ujt
JOIN job_types jt ON ujt.job_type_id = jt.id
WHERE ujt.user_id = ?
ORDER BY jt.category, jt.name;
```

### Get active subscription for user
```sql
SELECT * FROM subscriptions
WHERE user_id = ? AND is_active = 1
ORDER BY created_at DESC
LIMIT 1;
```

### Get jobs visible to user based on tier
```sql
-- Free tier (24hr old jobs)
SELECT * FROM jobs
WHERE status = 'open' 
  AND created_at <= datetime('now', '-24 hours')
ORDER BY created_at DESC;

-- Bronze tier (3hr old jobs)
SELECT * FROM jobs
WHERE status = 'open' 
  AND created_at <= datetime('now', '-3 hours')
ORDER BY created_at DESC;

-- God tier (all jobs including god-tier)
SELECT * FROM jobs
WHERE status = 'open'
ORDER BY created_at DESC;
```

### Get jobs by profession
```sql
-- Find jobs matching user's professions
SELECT DISTINCT j.* FROM jobs j
JOIN job_types jt ON j.job_type_id = jt.id
WHERE jt.category IN (
  SELECT DISTINCT p.category FROM professions p
  JOIN user_professions up ON p.id = up.profession_id
  WHERE up.user_id = ?
)
AND j.status = 'open'
ORDER BY j.created_at DESC;
```

### Get user's contact transactions
```sql
SELECT 
  ct.type,
  ct.credits_used,
  ct.created_at,
  j.title as job_title,
  u.name as other_user_name
FROM contact_transactions ct
JOIN jobs j ON ct.job_id = j.id
LEFT JOIN users u ON u.id = CASE 
  WHEN ct.from_user_id = ? THEN ct.to_user_id 
  ELSE ct.from_user_id 
END
WHERE ct.from_user_id = ? OR ct.to_user_id = ?
ORDER BY ct.created_at DESC;
```

### Get user's reviews and average rating
```sql
-- Average rating
SELECT 
  COUNT(*) as review_count,
  AVG(stars) as avg_rating,
  SUM(CASE WHEN stars = 5 THEN 1 ELSE 0 END) as five_star,
  SUM(CASE WHEN stars = 4 THEN 1 ELSE 0 END) as four_star,
  SUM(CASE WHEN stars = 3 THEN 1 ELSE 0 END) as three_star,
  SUM(CASE WHEN stars = 2 THEN 1 ELSE 0 END) as two_star,
  SUM(CASE WHEN stars = 1 THEN 1 ELSE 0 END) as one_star
FROM reviews
WHERE reviewee_id = ?;

-- Recent reviews
SELECT 
  r.stars,
  r.comment,
  r.created_at,
  reviewer.name as reviewer_name,
  j.title as job_title
FROM reviews r
JOIN users reviewer ON r.reviewer_id = reviewer.id
JOIN jobs j ON r.job_id = j.id
WHERE r.reviewee_id = ?
ORDER BY r.created_at DESC
LIMIT 10;
```

### Get poster's active packages
```sql
SELECT 
  pp.*,
  j.title as job_title,
  (pp.tradies_limit - pp.tradies_unlocked) as remaining_unlocks
FROM poster_packages pp
JOIN jobs j ON pp.job_id = j.id
WHERE pp.user_id = ? 
  AND pp.is_active = 1
  AND (pp.expires_at IS NULL OR pp.expires_at > datetime('now'))
ORDER BY pp.created_at DESC;
```

### Get job applications with tradie details
```sql
SELECT 
  a.*,
  u.name,
  u.email,
  u.phone,
  u.tier,
  GROUP_CONCAT(p.name) as professions
FROM applications a
JOIN users u ON a.tradie_id = u.id
LEFT JOIN user_professions up ON u.id = up.user_id
LEFT JOIN professions p ON up.profession_id = p.id
WHERE a.job_id = ?
GROUP BY a.id
ORDER BY a.created_at DESC;
```

## Key Enums

### User Roles
- `poster` - Posts jobs
- `tasker` - Does jobs
- `both` - Can do both

### User Tiers
- `free` - 24hr delay
- `bronze` - 3hr delay
- `silver` - 2hr delay
- `gold` - 1hr delay
- `platinum` - Instant access
- `god` - Admin tier

### Job Status
- `open` - Accepting applications
- `awarded` - Awarded to a tradie
- `in-progress` - Work in progress
- `complete` - Work completed
- `cancelled` - Job cancelled

### Application Status
- `pending` - Awaiting poster response
- `accepted` - Accepted by poster
- `rejected` - Rejected by poster

### Contact Transaction Types
- `send-profile` - Tasker sent profile (1 credit)
- `full-contact` - Tasker unlocked full job (2 credits)
- `poster-unlock-tradie` - Poster unlocked single tradie
- `poster-3-pack` - Poster bought 3-tradie pack
- `poster-20-pack` - Poster bought 20-tradie pack

### Qualification Types
- `tafe` - TAFE qualification
- `university` - University degree
- `other` - Other qualification

### Profession Categories
- `core-trades` - Core building trades
- `specialised` - Specialised construction
- `adjacent` - Building-adjacent trades
- `maintenance` - Property maintenance
- `home-services` - Home services
- `transport` - Transport & delivery

### Job Type Categories
- `building-construction` - Building & construction
- `maintenance-garden` - Maintenance & garden
- `transport-delivery` - Transport & delivery

## Useful Aggregations

### Platform stats (for admin)
```sql
SELECT 
  (SELECT COUNT(*) FROM users WHERE role = 'poster') as poster_count,
  (SELECT COUNT(*) FROM users WHERE role = 'tasker') as tasker_count,
  (SELECT COUNT(*) FROM users WHERE role = 'both') as both_count,
  (SELECT COUNT(*) FROM jobs) as total_jobs,
  (SELECT COUNT(*) FROM jobs WHERE status = 'open') as open_jobs,
  (SELECT COUNT(*) FROM jobs WHERE status = 'complete') as completed_jobs,
  (SELECT COUNT(*) FROM applications) as total_applications,
  (SELECT SUM(credits_used) FROM contact_transactions) as total_credits_spent;
```

### Tier distribution
```sql
SELECT 
  tier,
  COUNT(*) as user_count,
  SUM(credits) as total_credits
FROM users
WHERE role IN ('tasker', 'both')
GROUP BY tier
ORDER BY 
  CASE tier
    WHEN 'god' THEN 1
    WHEN 'platinum' THEN 2
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 4
    WHEN 'bronze' THEN 5
    WHEN 'free' THEN 6
  END;
```

### Most active taskers
```sql
SELECT 
  u.name,
  u.tier,
  COUNT(a.id) as application_count,
  SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
  AVG(r.stars) as avg_rating
FROM users u
LEFT JOIN applications a ON u.id = a.tradie_id
LEFT JOIN reviews r ON u.id = r.reviewee_id
WHERE u.role IN ('tasker', 'both')
GROUP BY u.id
HAVING COUNT(a.id) > 0
ORDER BY accepted_count DESC, application_count DESC
LIMIT 20;
```

### Most popular professions
```sql
SELECT 
  p.name,
  p.category,
  COUNT(up.user_id) as tasker_count
FROM professions p
LEFT JOIN user_professions up ON p.id = up.profession_id
GROUP BY p.id
ORDER BY tasker_count DESC, p.name
LIMIT 20;
```

### Job type demand
```sql
SELECT 
  jt.name,
  jt.category,
  COUNT(j.id) as job_count
FROM job_types jt
LEFT JOIN jobs j ON jt.id = j.job_type_id
WHERE j.created_at > datetime('now', '-30 days')
GROUP BY jt.id
ORDER BY job_count DESC, jt.name
LIMIT 20;
```
