const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

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
    doc.text(businessDetails.business_name || 'TradieTasker', { align: 'left' });
    doc.text(`ABN: ${businessDetails.business_abn || '72 688 296 013'}`);
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
    doc.text(`$${parseFloat(invoice.amount).toFixed(2)}`, 450, y, { align: 'right' });
    
    if (gstEnabled && invoice.gst_amount > 0) {
      doc.text('GST (10%):', 350, y + 20);
      doc.text(`$${parseFloat(invoice.gst_amount).toFixed(2)}`, 450, y + 20, { align: 'right' });
    }
    
    doc.fontSize(12).font('Helvetica-Bold');
    const totalY = gstEnabled && invoice.gst_amount > 0 ? y + 40 : y + 20;
    doc.text('Total:', 350, totalY);
    doc.text(`$${parseFloat(invoice.total).toFixed(2)}`, 450, totalY, { align: 'right' });

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
    const invoices = await query(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(invoices);
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
    
    const invoice = await get(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    );
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
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
    
    const invoice = await get(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoiceId, userId]
    );
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // If Stripe invoice URL exists, redirect to it
    if (invoice.stripe_invoice_id && invoice.pdf_url && invoice.pdf_url.startsWith('http')) {
      return res.redirect(invoice.pdf_url);
    }
    
    // Otherwise serve local PDF
    const pdfPath = path.join(INVOICES_DIR, `invoice-${invoice.invoice_number}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      // Generate PDF if it doesn't exist
      const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
      const gstSetting = await get('SELECT value FROM admin_settings WHERE key = ?', ['gst_enabled']);
      const abn = await get('SELECT value FROM admin_settings WHERE key = ?', ['business_abn']);
      const bizName = await get('SELECT value FROM admin_settings WHERE key = ?', ['business_name']);
      
      const gstEnabled = gstSetting && gstSetting.value === 'true';
      const businessDetails = {
        business_abn: abn ? abn.value : '72 688 296 013',
        business_name: bizName ? bizName.value : 'Drachen Pty Ltd'
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
    const gstSetting = await get('SELECT value FROM admin_settings WHERE key = ?', ['gst_enabled']);
    const gstEnabled = gstSetting && gstSetting.value === 'true';
    
    // Calculate amounts
    const baseAmount = parseFloat(amount);
    const gstAmount = gstEnabled ? baseAmount * 0.1 : 0;
    const totalAmount = baseAmount + gstAmount;
    
    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();
    
    // Insert invoice
    const result = await run(
      `INSERT INTO invoices (user_id, invoice_number, stripe_invoice_id, amount, gst_amount, total, status, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id`,
      [targetUserId, invoiceNumber, stripeInvoiceId || null, baseAmount, gstAmount, totalAmount, status, description]
    );
    
    const invoiceId = result.lastID;
    const invoice = await get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    
    // Get user details
    const user = await get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    
    // Get business details
    const abn = await get('SELECT value FROM admin_settings WHERE key = ?', ['business_abn']);
    const bizName = await get('SELECT value FROM admin_settings WHERE key = ?', ['business_name']);
    
    const businessDetails = {
      business_abn: abn ? abn.value : '72 688 296 013',
      business_name: bizName ? bizName.value : 'Drachen Pty Ltd'
    };
    
    // Generate PDF
    const pdfPath = await generateInvoicePDF(invoice, user, businessDetails, gstEnabled);
    
    // Update invoice with PDF URL
    await run(
      'UPDATE invoices SET pdf_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [`/api/invoices/${invoiceId}/pdf`, invoiceId]
    );
    
    // Send email
    await sendInvoiceEmail(user, invoice, pdfPath);
    
    res.status(201).json({
      message: 'Invoice generated successfully',
      invoice: {
        ...invoice,
        pdf_url: `/api/invoices/${invoiceId}/pdf`
      }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

module.exports = router;
