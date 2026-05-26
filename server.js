const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase } = require('./auto-init');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskerRoutes = require('./routes/taskers');
const jobRoutes = require('./routes/jobs');
const professionRoutes = require('./routes/professions');
const jobTypeRoutes = require('./routes/jobTypes');
const contactRoutes = require('./routes/contact');
const reviewRoutes = require('./routes/reviews');
const subscriptionRoutes = require('./routes/subscriptions');
const stripeRoutes = require('./routes/stripe');
const creditRoutes = require('./routes/credits');
const customerRoutes = require('./routes/customers');
const profileUnlockRoutes = require('./routes/profileUnlocks');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const adminAuthRoutes = require('./routes/adminAuth');
const adminTiersRoutes = require('./routes/admin/tiers');
const adminPackagesRoutes = require('./routes/admin/packages');
const adminTaxRoutes = require('./routes/admin/tax');
const adminSettingsRoutes = require('./routes/admin/settings');
const adminPromoCodesRoutes = require('./routes/admin/promo-codes');
const adminUsersRoutes = require('./routes/admin/users');
const adminJobsRoutes = require('./routes/admin/jobs');
const adminStatsRoutesNew = require('./routes/admin/stats');
const adminProfessionsRoutes = require('./routes/admin/professions');
const adminJobTypesRoutes = require('./routes/admin/job-types');
const adminReviewsRoutes = require('./routes/admin/reviews');
const adminTransactionsRoutes = require('./routes/admin/transactions');
const adminPackagesRoutes = require('./routes/admin/packages');
const referralsRoutes = require('./routes/referrals');
const versionRoutes = require('./routes/version');
const seedRoutes = require('./routes/seed');
const migrateAdminRoutes = require('./routes/migrate-admin');
const debugRoutesRoutes = require('./routes/debug-routes');
const tradieDashboardRoutes = require('./routes/tradie-dashboard');
const customerDashboardRoutes = require('./routes/customer-dashboard');
const messagesRoutes = require('./routes/messages');
// const promoCodeRoutes = require('./routes/promoCodes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));

// Parse JSON bodies (increased limit for potential file uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/taskers', taskerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/professions', professionRoutes);
app.use('/api/job-types', jobTypeRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/profile-unlocks', profileUnlockRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
// Specific admin routes MUST come before generic catch-all routes
app.use('/api/admin/stats', adminStatsRoutesNew);
app.use('/api/admin/tiers', adminTiersRoutes);
app.use('/api/admin/packages', adminPackagesRoutes);
app.use('/api/admin/tax', adminTaxRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/promo-codes', adminPromoCodesRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/jobs', adminJobsRoutes);
app.use('/api/admin/professions', adminProfessionsRoutes);
app.use('/api/admin/job-types', adminJobTypesRoutes);
app.use('/api/admin/reviews', adminReviewsRoutes);
app.use('/api/admin/transactions', adminTransactionsRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);
app.use('/api/admin/referrals', adminReferralsRoutes);
app.use('/api/admin/packages', adminPackagesRoutes);
// Generic admin routes last (catch-all for remaining /api/admin/* routes)
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/tradie-dashboard', tradieDashboardRoutes);
app.use('/api/customer-dashboard', customerDashboardRoutes);
app.use('/api/messages', messagesRoutes);
// app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/migrate-admin', migrateAdminRoutes);
app.use('/api/debug/routes', debugRoutesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Auto-initialize database on startup
(async () => {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Continue startup even if auto-init fails (database might already be set up)
  }
  
  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 TradieTasker API server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
})();

module.exports = app;