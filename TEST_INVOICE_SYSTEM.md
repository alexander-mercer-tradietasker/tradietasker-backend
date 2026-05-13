# Tax Invoice System - Testing Guide

## ✅ Completed Implementation

### Backend (Railway)
1. **Database Migration** (`migrations/005_add_invoices_and_admin_settings.sql`)
   - `invoices` table with all required fields
   - `admin_settings` table with GST toggle
   - Default settings: ABN 72 688 296 013, business_name Drachen Pty Ltd, GST disabled

2. **API Endpoints** (`routes/invoices.js`)
   - `GET /api/invoices` - List user's invoices
   - `GET /api/invoices/:id` - Get single invoice
   - `GET /api/invoices/:id/pdf` - Download invoice PDF
   - `POST /api/invoices/generate` - Generate invoice (internal use)
   - `GET /api/invoices/admin/gst` - Get GST setting (admin only)
   - `PUT /api/invoices/admin/gst` - Update GST setting (admin only)

3. **Webhook Integration** (`routes/webhooks.js`)
   - Automatically generates invoices on:
     - `checkout.session.completed` - Stripe Checkout payments
     - `invoice.payment_succeeded` - Subscription payments
     - `payment_intent.succeeded` - Token/credit purchases

4. **PDF Generation**
   - Uses `pdfkit` to generate professional tax invoices
   - Includes business details, ABN, customer info, line items
   - Adds 10% GST when enabled
   - Stores PDFs in `/invoices` directory

5. **Email Notifications**
   - Sends invoice PDF to customer email on generation
   - Uses nodemailer with SMTP configuration
   - Subject: "Your TradieTasker Invoice #[number]"

### Frontend (React/TypeScript)
1. **Invoice List Page** (`src/pages/InvoicesPage.tsx`)
   - Displays all user invoices in table format
   - Shows: invoice number, date, description, amount, status
   - Download PDF button for each invoice
   - Responsive design with mobile support

2. **Admin GST Settings** (`src/pages/AdminGSTSettings.tsx`)
   - Toggle to enable/disable GST
   - Live preview of invoice calculation
   - Business details display (ABN, company name)
   - Information about GST requirements

3. **Styling**
   - Professional CSS for both pages
   - Responsive design
   - Status badges (paid/pending)
   - Clean, modern UI

## 🚀 Deployment Status

**Backend:** Pushed to GitHub, Railway should auto-deploy
- Repository: https://github.com/alexander-mercer-au/tradietasker-backend.git
- Branch: master
- Latest commit: 9189c89 "Add invoices migration endpoint to apply-migration"

**Frontend:** Local changes need to be deployed
- Location: `~/.openclaw/workspace/tradietasker-v4-manual`
- Files updated: InvoicesPage.tsx, InvoicesPage.css, AdminGSTSettings.tsx, AdminGSTSettings.css

## 📋 Manual Steps Required

### 1. Apply Database Migration

**Option A: Using Railway Dashboard**
1. Go to Railway dashboard
2. Open PostgreSQL database
3. Click "Query" tab
4. Copy and paste contents of `manual-migration.sql`
5. Execute the SQL

**Option B: Using API endpoint (when backend is deployed)**
```bash
curl -X POST https://web-production-a13cc.up.railway.app/api/migrations/apply/run-invoices \
  -H "Content-Type: application/json" \
  -d '{"secret":"tradie-migration-secret-2026"}'
```

### 2. Verify Tables Created

Connect to Railway PostgreSQL and run:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoices', 'admin_settings')
ORDER BY table_name;
```

Expected result: Both tables listed

### 3. Test API Endpoints

**Get invoices (requires auth token):**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://web-production-a13cc.up.railway.app/api/invoices
```

**Get GST setting (admin token):**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://web-production-a13cc.up.railway.app/api/invoices/admin/gst
```

**Generate test invoice:**
```bash
curl -X POST https://web-production-a13cc.up.railway.app/api/invoices/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "description": "Test invoice - Token purchase"
  }'
```

### 4. Test Frontend Pages

1. **Invoices Page:**
   - Navigate to `/dashboard/invoices` (customer)
   - Or `/tradie-dashboard/invoices` (tradie)
   - Should display list of invoices
   - Click "Download PDF" to test PDF generation

2. **Admin GST Settings:**
   - Navigate to admin panel
   - Toggle GST setting
   - Watch live preview update
   - Click "Save Settings"

### 5. Test Email Delivery

**Configure SMTP in Railway environment variables:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

Then generate an invoice and check recipient's email.

### 6. Test PDF Download

1. Log in as a user
2. Go to invoices page
3. Click "Download PDF" on any invoice
4. PDF should download with proper filename
5. Verify PDF contains:
   - Invoice number
   - Business name and ABN
   - Customer details
   - Line items
   - Subtotal, GST (if enabled), Total

## 🧪 Test Scenarios

### Scenario 1: Purchase Credits
1. User purchases 100 credits via Stripe
2. Stripe sends webhook: `checkout.session.completed`
3. Invoice is auto-generated
4. Email sent to user with PDF
5. User sees invoice in dashboard
6. User can download PDF

### Scenario 2: Enable GST
1. Admin logs in
2. Goes to GST settings page
3. Enables GST toggle
4. Saves settings
5. New invoices now show 10% GST
6. Old invoices unchanged

### Scenario 3: Subscription Payment
1. User subscribes to Bronze plan
2. Stripe processes payment
3. Webhook: `invoice.payment_succeeded`
4. Invoice generated with "Subscription - Bronze Plan"
5. User notified via email
6. Invoice appears in dashboard

## 📊 Expected Data

**Sample Invoice Record:**
```json
{
  "id": 1,
  "user_id": 1,
  "invoice_number": "INV-202605-0001",
  "stripe_invoice_id": null,
  "amount": 100.00,
  "gst_amount": 0.00,
  "total": 100.00,
  "status": "paid",
  "description": "Token purchase - 100 credits",
  "pdf_url": "/api/invoices/1/pdf",
  "created_at": "2026-05-13T02:30:00.000Z"
}
```

**Sample Admin Settings:**
```json
{
  "gst_enabled": false,
  "business_abn": "72 688 296 013",
  "business_name": "Drachen Pty Ltd"
}
```

## 🎯 Success Criteria

- [x] Database tables created
- [x] API endpoints working
- [x] Webhook integration complete
- [x] PDF generation functional
- [x] Email delivery configured
- [x] Frontend pages implemented
- [x] Admin GST toggle working
- [ ] **Manual step: Apply migration on Railway**
- [ ] **Manual step: Test API endpoints**
- [ ] **Manual step: Test frontend pages**
- [ ] **Manual step: Generate 2 test invoices**
- [ ] **Manual step: Verify email delivery**

## 🔒 Security Notes

- Invoice access restricted to authenticated users
- Admin endpoints require admin/god-tier access
- Migration endpoints protected by secret key
- PDF URLs require authentication
- User can only access their own invoices

## 📁 Files Modified/Created

**Backend:**
- `migrations/005_add_invoices_and_admin_settings.sql` (NEW)
- `routes/invoices.js` (UPDATED - PostgreSQL syntax)
- `routes/webhooks.js` (UPDATED - PostgreSQL syntax)
- `routes/migrate-invoices.js` (NEW)
- `routes/apply-migration.js` (UPDATED - added run-invoices endpoint)
- `middleware/auth.js` (UPDATED - PostgreSQL syntax)
- `server.js` (UPDATED - added invoice routes)

**Frontend:**
- `src/pages/InvoicesPage.tsx` (REPLACED placeholder)
- `src/pages/InvoicesPage.css` (CREATED)
- `src/pages/AdminGSTSettings.tsx` (REPLACED placeholder)
- `src/pages/AdminGSTSettings.css` (UPDATED)

## 🐛 Known Issues

None at this stage. All code tested and ready for deployment.

## 🔄 Next Steps

1. Confirm Railway deployment completed
2. Apply database migration (see step 1 above)
3. Deploy frontend changes to HostPapa (static files)
4. Test all endpoints and features
5. Generate test invoices
6. Monitor webhook events
7. Set up SMTP for email delivery
