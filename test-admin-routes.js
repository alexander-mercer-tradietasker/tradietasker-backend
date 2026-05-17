// Quick test to verify routes are loaded correctly
const express = require('express');
const app = express();

try {
  const adminAuthRoutes = require('./routes/adminAuth');
  const adminStatsRoutes = require('./routes/adminStats');
  const adminRoutes = require('./routes/admin');
  
  console.log('✅ All admin route modules loaded successfully');
  console.log('adminAuthRoutes:', typeof adminAuthRoutes);
  console.log('adminStatsRoutes:', typeof adminStatsRoutes);
  console.log('adminRoutes:', typeof adminRoutes);
  
  app.use('/api/admin-auth', adminAuthRoutes);
  app.use('/api/admin', adminStatsRoutes);
  app.use('/api/admin', adminRoutes);
  
  console.log('\n✅ All routes mounted successfully');
  console.log('Registered routes:');
  app._router.stack.forEach((r) => {
    if (r.route) {
      console.log(`  ${Object.keys(r.route.methods)} ${r.route.path}`);
    } else if (r.name === 'router') {
      console.log(`  Router mounted at: ${r.regexp}`);
    }
  });
  
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  console.error(error.stack);
  process.exit(1);
}
