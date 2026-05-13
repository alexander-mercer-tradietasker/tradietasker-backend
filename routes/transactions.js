const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// GET /api/transactions - Get user's transaction history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, start_date, end_date } = req.query;
    
    let sql = `
      SELECT id, type, amount, balance_after, description, created_at
      FROM transactions
      WHERE user_id = ?
    `;
    
    const params = [userId];
    
    // Filter by transaction type
    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    // Filter by date range
    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const transactions = await query(sql, params);
    
    res.json({
      success: true,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        balanceAfter: parseFloat(t.balance_after),
        description: t.description,
        createdAt: t.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions'
    });
  }
});

// GET /api/transactions/csv - Download transactions as CSV
router.get('/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, start_date, end_date } = req.query;
    
    let sql = `
      SELECT type, amount, balance_after, description, created_at
      FROM transactions
      WHERE user_id = ?
    `;
    
    const params = [userId];
    
    // Filter by transaction type
    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    // Filter by date range
    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const transactions = await query(sql, params);
    
    // Build CSV content
    const csvRows = [];
    csvRows.push('Date,Description,Amount,Balance'); // Header
    
    transactions.forEach(t => {
      const date = new Date(t.created_at).toLocaleString('en-AU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const description = t.description.replace(/"/g, '""'); // Escape quotes
      const amount = parseFloat(t.amount).toFixed(2);
      const balance = parseFloat(t.balance_after).toFixed(2);
      
      csvRows.push(`"${date}","${description}",${amount},${balance}`);
    });
    
    const csvContent = csvRows.join('\n');
    
    // Generate filename with current date
    const filename = `account-statement-${new Date().toISOString().split('T')[0]}.csv`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSV'
    });
  }
});

module.exports = router;
