const jwt = require('jsonwebtoken');
const { get } = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'tradietasker-secret-key-change-in-production';

// Verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      // Load user from database
      const user = await get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

// Optional authentication (doesn't fail if no token)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      req.user = null;
      return next();
    }

    try {
      const user = await get('SELECT * FROM users WHERE id = ?', [decoded.userId]);
      req.user = user || null;
      next();
    } catch (error) {
      req.user = null;
      next();
    }
  });
}

// Role-based authorization
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    const hasRole = userRoles.some(role => allowedRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Tier-based authorization
function requireTier(minTier) {
  const tierOrder = ['free', 'bronze', 'silver', 'gold', 'platinum', 'god'];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userTierIndex = tierOrder.indexOf(req.user.tier);
    const minTierIndex = tierOrder.indexOf(minTier);

    if (userTierIndex < minTierIndex) {
      return res.status(403).json({ 
        error: `${minTier} tier or higher required`,
        currentTier: req.user.tier,
        requiredTier: minTier
      });
    }

    next();
  };
}

// God tier only
function requireGodTier(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.tier !== 'god') {
    return res.status(403).json({ error: 'God tier access required' });
  }

  next();
}

// Generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireTier,
  requireGodTier,
  generateToken,
  JWT_SECRET
};
