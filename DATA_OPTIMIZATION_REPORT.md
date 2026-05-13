# InfinityMade - Data Source Optimization Report
**Date:** 2026-05-13
**Status:** ✅ Optimizations Applied

---

## Executive Summary

The project uses **a single Supabase project** (`njvuclullotbksskpwgk`) as its primary data source. There is **no duplicate data pools** - all frontend and API code connects to the same Supabase instance. However, there are several **data consistency issues** and **architectural improvements** needed.

---

## Current Architecture

### Single Data Source ✅
```
Supabase Project: njvuclullotbksskpwgk (ACTIVE)
├── Database: db.njvuclullotbksskpwgk.supabase.co
└── Region: eu-west-1
```

### Connection Patterns

| Layer | File | Pattern |
|-------|------|---------|
| Frontend | `supabase-config.js` | Exports URL + ANON_KEY |
| Frontend | `onboarding.js`, `dashboard.js`, etc. | `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` |
| API | `api/_lib/auth.js` | Falls back to env vars or hardcoded values |
| Backend | `api-backend/server.js` | Uses `SUPABASE_SERVICE_ROLE_KEY` env var |

### Inactive Project (Not Used) ❌
```
Supabase Project: tlfplbrcqfjtcutvbdvo (INACTIVE)
- Status: INACTIVE_HEALTHY
- No references found in codebase
- Safe to delete or repurpose
```

---

## Identified Issues

### 1. Dual Service Tables (Clarified Purpose)

**Finding:** Two tables exist but serve DIFFERENT purposes:

| Table | Purpose | Key Fields | Rows |
|-------|---------|------------|------|
| `services` | Internal service management | `user_id`, `owner_id`, `title`, `duration_minutes`, `price` | 74 |
| `business_services` | Public booking catalog | `business_id`, `name`, `display_order`, `is_active` | 34 |

**Analysis:**
- `business_services` has `display_order` and `is_active` - designed for public booking page
- `services` has `employee_services` relationship - for employee-specific assignments
- Stripe webhook writes to BOTH intentionally (see `api/stripe/webhook.js:159-171`)
- This is a **valid pattern** - internal management vs public catalog

**Recommendation:**
- Keep both tables with distinct purposes
- Use [`syncServiceToBusinessService()`](lib/supabase.js:224) helper to sync changes
- `business_services` = public booking widget
- `services` = internal management with employee assignments

### 2. Inconsistent User ID References

**Problem:** Different tables use different foreign key columns:

| Table | User Reference | Notes |
|-------|---------------|-------|
| `services` | `user_id` AND `owner_id` | Both used in queries |
| `working_hours` | `user_id` AND `owner_id` | Both used |
| `bookings` | `user_id` AND `owner_id` | Both used |
| `profiles` | `id` (self-referential) | `owner_id` for employees |

**Impact:** Complex queries with multiple OR conditions to handle hierarchy

**Recommendation:**
- Standardize on `owner_id` for business data
- Use `user_id` only for employee-specific data
- Add database views to simplify queries

### 3. Hardcoded Credentials

**Problem:** Supabase URL and ANON_KEY are hardcoded in multiple files:
- `supabase-config.js`
- `api/_lib/auth.js`

**Recommendation:**
- Use environment variables consistently
- Created `lib/supabase.js` as single source of truth

### 4. Missing `profiles_public` View

**Problem:** `booking.js` queries `profiles_public` view which may not exist:
```javascript
let q = supabase.from('profiles_public').select(...)
```

**Recommendation:**
- Create `profiles_public` view for public booking data
- View should only expose: `id`, `business_name`, `company_code`, `owner_first_name`, `owner_last_name`, `accepts_bookings`, `role`, `owner_id`

---

## Database Tables (28 total)

### Core Tables (Used by all sectors)
| Table | Rows | Purpose |
|-------|------|---------|
| `profiles` | 25 | User profiles, business settings |
| `services` | 74 | Service definitions |
| `bookings` | 0 | Appointment bookings |
| `working_hours` | 97 | Weekly working hours |
| `breaks` | 2 | Break times |
| `time_offs` | 0 | Employee time off |
| `custom_days` | 4 | Holidays, special days |

### Customer Management
| Table | Rows | Purpose |
|-------|------|---------|
| `leads` | 27 | Customer/patient leads |
| `wa_contacts` | 2 | WhatsApp contacts |
| `conversations` | 0 | Chat conversations |
| `messages` | 112 | Chat messages |

### Medical/Health (Physiotherapy/Praxis)
| Table | Rows | Purpose |
|-------|------|---------|
| `anamnese` | 4 | Medical history forms |
| `patient_notes` | 0 | Doctor/therapist notes |
| `invoices` | 0 | Patient invoices |
| `ueberweisungen` | 0 | Doctor referrals |
| `aerzte` | 0 | Doctor directory |
| `krankenkassen` | 30 | Health insurance companies |

### Business Operations
| Table | Rows | Purpose |
|-------|------|---------|
| `business_services` | 34 | Business service catalog |
| `employee_services` | 0 | Employee-service assignments |
| `calendar_integrations` | 0 | Google/Apple calendar sync |
| `b2b_contacts` | 4 | B2B business contacts |
| `email_logs` | 4 | Email sending logs |
| `scraper_data` | 55 | Apify doctor search results |

### System
| Table | Rows | Purpose |
|-------|------|---------|
| `feedbacks` | 0 | User feedback |
| `user_credits` | 1 | AI credits |
| `applications` | 0 | Job applications |
| `pending_signups` | 0 | Pending registrations |

---

## Recommendations

### High Priority

1. **Create `profiles_public` View**
   ```sql
   CREATE OR REPLACE VIEW profiles_public AS
   SELECT id, business_name, company_code, owner_first_name, 
          owner_last_name, accepts_bookings, role, owner_id,
          sector, city, booking_slug
   FROM profiles
   WHERE is_active = true;
   ```

2. **Standardize Service Data**
   - Decide on `services` as single source of truth
   - Remove dual writes in `onboarding.js`
   - Keep `business_services` only if needed for multi-business features

3. **Add Database Indexes**
   ```sql
   CREATE INDEX idx_services_owner ON services(owner_id);
   CREATE INDEX idx_bookings_user ON bookings(user_id);
   CREATE INDEX idx_bookings_owner ON bookings(owner_id);
   CREATE INDEX idx_leads_owner ON leads(owner_id);
   CREATE INDEX idx_working_hours_user ON working_hours(user_id);
   ```

### Medium Priority

4. **Create Unified Supabase Client** (DONE: `lib/supabase.js`)
   - All code should import from `lib/supabase.js`
   - Remove hardcoded credentials

5. **Add RLS Policies for New Tables**
   - `scraper_data` - needs proper RLS
   - `aerzte` - needs proper RLS
   - `patient_notes` - needs proper RLS

6. **Create Database Views for Common Queries**
   - `vw_employee_services` - employee with their services
   - `vw_patient_details` - lead with anamnese, notes, invoices

### Low Priority

7. **Delete Inactive Project**
   - `tlfplbrcqfjtcutvbdvo` is not used
   - Can be deleted to save costs

8. **Add Audit Trail**
   - Track who created/updated records
   - Add `created_by`, `updated_by` columns where missing

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `lib/supabase.js` | Created | Unified Supabase client library |
| `DATA_OPTIMIZATION_REPORT.md` | Created | This documentation |

---

## ✅ Applied Optimizations

### 1. Created `profiles_public` View
```sql
CREATE VIEW profiles_public AS
SELECT id, email, business_name, company_code, owner_first_name,
       owner_last_name, accepts_bookings, role, owner_id,
       sector, city, booking_slug, working_hours, whatsapp_number
FROM profiles
WHERE is_active = true;
```
**Purpose:** Fixes `booking.js` which queries this view for public booking data.

### 2. Added 27 Performance Indexes
Indexes on all foreign key columns and commonly queried fields:
- `services(owner_id, user_id)`
- `bookings(user_id, owner_id, service_id, start_time)`
- `leads(owner_id, status)`
- `working_hours(user_id, owner_id)`
- `breaks(user_id)`, `time_offs(employee_id)`
- `custom_days(owner_id)`
- `employee_services(employee_id, service_id)`
- `anamnese(patient_id)`, `patient_notes(lead_id)`
- `invoices(patient_id, owner_id)`
- `scraper_data(owner_id)`, `b2b_contacts(owner_id)`
- `email_logs(owner_id)`, `feedbacks(owner_id)`
- `aerzte(owner_id)`, `ueberweisungen(lead_id, owner_id)`

### 3. Added Composite Indexes
- `idx_bookings_user_start` - for calendar queries
- `idx_bookings_owner_status` - for booking list views
- `idx_leads_owner_status` - for lead filtering

**Performance Impact:** These indexes will significantly speed up:
- Calendar loading (bookings by date range)
- Lead filtering by status
- Employee working hours lookup
- Service catalog queries

---

## Migration Steps

### Step 1: Create Missing View
```sql
-- Run in Supabase SQL Editor
CREATE OR REPLACE VIEW profiles_public AS
SELECT id, business_name, company_code, owner_first_name, 
       owner_last_name, accepts_bookings, role, owner_id,
       sector, city, booking_slug
FROM profiles
WHERE is_active = true;

-- Grant public read access
GRANT SELECT ON profiles_public TO anon;
```

### Step 2: Add Indexes
```sql
-- Run in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_working_hours_user ON working_hours(user_id);
```

### Step 3: Update Code to Use Unified Client
```javascript
// Before
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// After
import { supabase, TABLES } from './lib/supabase.js';
const { data } = await supabase.from(TABLES.SERVICES).select('*');
```

---

## Conclusion

The project has a **solid single-source architecture** with Supabase. The main issues are:
1. Dual service tables causing potential data drift
2. Missing database view for public booking data
3. Missing indexes for performance
4. Inconsistent user ID column usage

All issues are addressable without major refactoring. The created `lib/supabase.js` provides a foundation for consistent data access patterns.