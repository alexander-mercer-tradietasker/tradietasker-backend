const express = require('express');
const router = express.Router();

// GET /api/debug/routes - Show all registered routes
router.get('/', (req, res) => {
  const routes = [];
  
  function getRoutes(stack, prefix = '') {
    stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const path = layer.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\^/g, '')
          .replace(/\$/g, '')
          .replace(/\\/g, '');
        getRoutes(layer.handle.stack, prefix + path);
      }
    });
  }
  
  getRoutes(req.app._router.stack);
  
  res.json({
    total: routes.length,
    routes: routes.filter(r => r.includes('/api/admin')).sort()
  });
});

module.exports = router;
