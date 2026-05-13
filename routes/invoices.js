const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Ensure invoices directory exists
const INVOICES_DIR = path.join(__dirname, '..', 'invoices');
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Generate unique invoice number
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
}

// Generate PDF invoice
async function generateInvoicePDF(invoice, user, businessDetails, gstEnabled) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const filename = `invoice-${invoice.invoice_number}.pdf`;
    const filepath = path.join(INVOICES_DIR, filename);
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('TAX INVOICE', { align: 'center' });
    doc.moveDown();

    // Business details
    doc.fontSize(10);
    doc.text(businessDetails.business_name || 'Drachen Pty Ltd', { align: 'left' });
    doc.text(`ABN: ${businessDetails.business_abn || '72 688 296 013'}`);
    if (gstEnabled) {
      doc.text('GST Registered');
    }
    doc.moveDown();

    // Invoice details
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoice_number}`);
    doc.fontSize(10).text(`Date: ${new Date(invoice.created_at).toLocaleDateString('en-AU')}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);
    doc.moveDown();

    // Customer details
    doc.fontSize(12).text('Bill To:');
    doc.fontSize(10).text(user.name);
    doc.text(user.email);
    if (user.phone) doc.text(user.phone);
    doc.moveDown();

    // Line items
    doc.fontSize(12).text('Description:');
    doc.fontSize(10).text(invoice.description || 'Service charge');
    doc.moveDown();

    // Amounts
    const y = doc.y;
    doc.fontSize(10);
    
    doc.text('Subtotal:', 350, y);
    doc.text(`$${parseFloat(invoice.amount).toFixed(2)}`, 450, y, { align: 'right', width: 100 });
    
    if (gstEnabled && invoice.gst_amount > 0) {
      doc.text('GST (10%):', 350, y + 20);
      doc.text(`$${parseFloat(invoice.gst_amount).toFixed(2)}`, 450, y + 20, { align: 'right', width: 100 });
    }
    
    doc.fontSize(12).font('Helvetica-Bold');
    const totalY = gstEnabled && invoice.gst_amount > 0 ? y + 40 : y + 20;
    doc.text('Total:', 350, totalY);
    doc.text(`$${parseFloat(invoice.total).toFixed(2)}`, 450, totalY, { align: 'right', width: 100 });

    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica').text('Thank you for your business!', { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

// Send invoice email
async function sendInvoiceEmail(user, invoice, pdfPath) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('Email not configured. Skipping invoice email.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: `Your TradieTasker Invoice #${invoice.invoice_number}`,
      html: `
        <h2>Tax Invoice</h2>
        <p>Dear ${user.name},</p>
        <p>Thank you for your payment. Please find your tax invoice attached.</p>
        <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
        <p><strong>Amount:</strong> $${parseFloat(invoice.total).toFixed(2)}</p>
        <p><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleDateString('en-AU')}</p>
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br>TradieTasker Team</p>
      `,
      attachments: [{
        filename: `invoice-${invoice.invoice_number}.pdf`,
        path: pdfPath
      }]
    });
    return true;
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    return false;
  }
}

// GET /api/invoices - Get user's invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id - Get single invoice
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const invoiceId = req.params.id;
    
    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// GET /api/invoices/:id/pdf - Download invoice PDF
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const invoiceId = req.params.id;
    
    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = result.rows[0];
    
    // If Stripe invoice URL exists, redirect to it
    if (invoice.stripe_invoice_id && invoice.pdf_url && invoice.pdf_url.startsWith('http')) {
      return res.redirect(invoice.pdf_url);
    }
    
    // Otherwise serve local PDF
    const pdfPath = path.join(INVOICES_DIR, `invoice-${invoice.invoice_number}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      // Generate PDF if it doesn't exist
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];
      
      const gstResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['gst_enabled']);
      const abnResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['business_abn']);
      const nameResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['business_name']);
      
      const gstEnabled = gstResult.rows.length > 0 && gstResult.rows[0].value === 'true';
      const businessDetails = {
        business_abn: abnResult.rows.length > 0 ? abnResult.rows[0].value : '72 688 296 013',
        business_name: nameResult.rows.length > 0 ? nameResult.rows[0].value : 'Drachen Pty Ltd'
      };
      
      await generateInvoicePDF(invoice, user, businessDetails, gstEnabled);
    }
    
    res.download(pdfPath, `invoice-${invoice.invoice_number}.pdf`);
  } catch (error) {
    console.error('Error downloading invoice PDF:', error);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

// POST /api/invoices/generate - Generate invoice (internal use + manual trigger)
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const {
      userId,
      amount,
      description,
      stripeInvoiceId,
      status = 'paid'
    } = req.body;
    
    // Use authenticated user if userId not provided
    const targetUserId = userId || req.user.id;
    
    // Get GST setting
    const gstResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['gst_enabled']);
    const gstEnabled = gstResult.rows.length > 0 && gstResult.rows[0].value === 'true';
    
    // Calculate amounts
    const baseAmount = parseFloat(amount);
    const gstAmount = gstEnabled ? baseAmount * 0.1 : 0;
    const totalAmount = baseAmount + gstAmount;
    
    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();
    
    // Insert invoice
    const result = await pool.query(
      `INSERT INTO invoices (user_id, invoice_number, stripe_invoice_id, amount, gst_amount, total, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [targetUserId, invoiceNumber, stripeInvoiceId || null, baseAmount, gstAmount, totalAmount, status, description]
    );
    
    const invoice = result.rows[0];
    
    // Get user details
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
    const user = userResult.rows[0];
    
    // Get business details
    const abnResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['business_abn']);
    const nameResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['business_name']);
    
    const businessDetails = {
      business_abn: abnResult.rows.length > 0 ? abnResult.rows[0].value : '72 688 296 013',
      business_name: nameResult.rows.length > 0 ? nameResult.rows[0].value : 'Drachen Pty Ltd'
    };
    
    // Generate PDF
    const pdfPath = await generateInvoicePDF(invoice, user, businessDetails, gstEnabled);
    
    // Update invoice with PDF URL
    await pool.query(
      'UPDATE invoices SET pdf_url = $1, updated_at = NOW() WHERE id = $2',
      [`/api/invoices/${invoice.id}/pdf`, invoice.id]
    );
    
    // Send email
    await sendInvoiceEmail(user, invoice, pdfPath);
    
    res.status(201).json({
      message: 'Invoice generated successfully',
      invoice: {
        ...invoice,
        pdf_url: `/api/invoices/${invoice.id}/pdf`
      }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// GET /api/admin/settings/gst - Get GST setting (admin only)
router.get('/admin/gst', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['gst_enabled']);
    const gstEnabled = result.rows.length > 0 && result.rows[0].value === 'true';
    res.json({ gst_enabled: gstEnabled });
  } catch (error) {
    console.error('Error fetching GST setting:', error);
    res.status(500).json({ error: 'Failed to fetch GST setting' });
  }
});

// PUT /api/admin/settings/gst - Update GST setting (admin only)
router.put('/admin/gst', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { gst_enabled } = req.body;
    
    await pool.query(
      `INSERT INTO admin_settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()`,
      ['gst_enabled', gst_enabled ? 'true' : 'false']
    );
    
    res.json({ 
      message: 'GST setting updated successfully',
      gst_enabled: gst_enabled 
    });
  } catch (error) {
    console.error('Error updating GST setting:', error);
    res.status(500).json({ error: 'Failed to update GST setting' });
  }
});

module.exports = router;
