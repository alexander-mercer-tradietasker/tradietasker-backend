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
const versionRoutes = require('./routes/version');
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
app.use('/api/admin', adminRoutes);
// app.use('/api/promo-codes', promoCodeRoutes);

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