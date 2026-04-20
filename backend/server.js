const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'acentepro_secret_2024';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const app = express();
app.use(cors());
app.use(express.json());

// ==================== AUTH MIDDLEWARE ====================
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Yetkisiz erişim' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gerekir' });
  next();
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

    // Admin check
    if (username === ADMIN_USER) {
      if (password !== ADMIN_PASS) return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre' });
      const token = jwt.sign({ id: 0, name: 'Admin', role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user: { id: 0, name: 'Admin', role: 'admin' } });
    }

    // Agency check
    const agency = db.prepare('SELECT * FROM agencies WHERE username=?').get(username);
    if (!agency || !agency.password_hash) return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre' });
    const ok = await bcrypt.compare(password, agency.password_hash);
    if (!ok) return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre' });

    const token = jwt.sign({ id: agency.id, name: agency.name, role: 'agency' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: agency.id, name: agency.name, role: 'agency' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Set agency credentials (admin only)
app.put('/api/agencies/:id/credentials', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli' });
    // Check username uniqueness
    const existing = db.prepare('SELECT id FROM agencies WHERE username=? AND id!=?').get(username, req.params.id);
    if (existing) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
    const hash = password ? await bcrypt.hash(password, 10) : null;
    if (hash) {
      db.prepare('UPDATE agencies SET username=?, password_hash=? WHERE id=?').run(username, hash, req.params.id);
    } else {
      db.prepare('UPDATE agencies SET username=? WHERE id=?').run(username, req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use('/uploads', express.static(uploadsDir));

// ==================== AGENCIES ====================
app.get('/api/agencies', authMiddleware, (req, res) => {
  try {
    if (req.user.role === 'agency') {
      const row = db.prepare('SELECT *, 0 as customer_count FROM agencies WHERE id=?').get(req.user.id);
      return res.json(row ? [row] : []);
    }
    const rows = db.prepare(`
      SELECT a.*, a.username, COUNT(DISTINCT c.id) as customer_count
      FROM agencies a LEFT JOIN customers c ON c.agency_id = a.id
      GROUP BY a.id ORDER BY a.name
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agencies/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.role === 'agency' && req.user.id !== parseInt(req.params.id))
      return res.status(403).json({ error: 'Yetkisiz' });
    const row = db.prepare('SELECT * FROM agencies WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agencies', authMiddleware, adminOnly, (req, res) => {
  try {
    const { name, email = '', phone = '', address = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Ad zorunludur' });
    const r = db.prepare('INSERT INTO agencies (name,email,phone,address) VALUES (?,?,?,?)').run(name, email, phone, address);
    res.json({ id: r.lastInsertRowid, name, email, phone, address });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/agencies/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const { name, email = '', phone = '', address = '' } = req.body;
    db.prepare('UPDATE agencies SET name=?,email=?,phone=?,address=? WHERE id=?').run(name, email, phone, address, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/agencies/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM agencies WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== COMPANIES ====================
app.get('/api/companies', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM companies ORDER BY name').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/companies', (req, res) => {
  try {
    const { name, email = '', phone = '', country = '', address = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Ad zorunludur' });
    const r = db.prepare('INSERT INTO companies (name,email,phone,country,address) VALUES (?,?,?,?,?)').run(name, email, phone, country, address);
    res.json({ id: r.lastInsertRowid, name, email, phone, country, address });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/companies/:id', (req, res) => {
  try {
    const { name, email = '', phone = '', country = '', address = '' } = req.body;
    db.prepare('UPDATE companies SET name=?,email=?,phone=?,country=?,address=? WHERE id=?').run(name, email, phone, country, address, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/companies/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM companies WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== CUSTOMERS ====================
app.get('/api/customers', authMiddleware, (req, res) => {
  try {
    let { agency_id } = req.query;
    if (req.user.role === 'agency') agency_id = req.user.id;
    let q = `
      SELECT c.*, a.name as agency_name,
        COUNT(DISTINCT s.id) as shipment_count,
        COALESCE(SUM(s.commission_amount),0) as total_commission
      FROM customers c
      LEFT JOIN agencies a ON c.agency_id = a.id
      LEFT JOIN shipments s ON s.customer_id = c.id
    `;
    const params = [];
    if (agency_id) { q += ' WHERE c.agency_id=?'; params.push(agency_id); }
    q += ' GROUP BY c.id ORDER BY c.name';
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', authMiddleware, adminOnly, (req, res) => {
  try {
    const { agency_id, name, email = '', phone = '', country = '', commission_rate = 0, notes = '' } = req.body;
    if (!agency_id || !name) return res.status(400).json({ error: 'Acente ve ad zorunludur' });
    const r = db.prepare('INSERT INTO customers (agency_id,name,email,phone,country,commission_rate,notes) VALUES (?,?,?,?,?,?,?)').run(agency_id, name, email, phone, country, commission_rate, notes);
    res.json({ id: r.lastInsertRowid, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/customers/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const { agency_id, name, email = '', phone = '', country = '', commission_rate = 0, notes = '' } = req.body;
    db.prepare('UPDATE customers SET agency_id=?,name=?,email=?,phone=?,country=?,commission_rate=?,notes=? WHERE id=?').run(agency_id, name, email, phone, country, commission_rate, notes, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/customers/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SHIPMENTS ====================
app.get('/api/shipments', authMiddleware, (req, res) => {
  try {
    let { customer_id, agency_id, company_id, start_date, end_date, status } = req.query;
    if (req.user.role === 'agency') agency_id = req.user.id;
    let q = `
      SELECT s.*,
        c.name as customer_name, c.commission_rate,
        a.name as agency_name,
        comp.name as company_name,
        (SELECT COUNT(*) FROM documents d WHERE d.shipment_id=s.id) as doc_count
      FROM shipments s
      LEFT JOIN customers c ON s.customer_id=c.id
      LEFT JOIN agencies a ON c.agency_id=a.id
      LEFT JOIN companies comp ON s.company_id=comp.id
      WHERE 1=1
    `;
    const params = [];
    if (customer_id) { q += ' AND s.customer_id=?'; params.push(customer_id); }
    if (agency_id) { q += ' AND c.agency_id=?'; params.push(agency_id); }
    if (company_id) { q += ' AND s.company_id=?'; params.push(company_id); }
    if (start_date) { q += ' AND s.shipment_date>=?'; params.push(start_date); }
    if (end_date) { q += ' AND s.shipment_date<=?'; params.push(end_date); }
    if (status) { q += ' AND s.status=?'; params.push(status); }
    q += ' ORDER BY s.shipment_date DESC, s.id DESC';
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shipments/:id', authMiddleware, (req, res) => {
  try {
    const s = db.prepare(`
      SELECT s.*,
        c.name as customer_name, c.commission_rate, c.email as customer_email,
        a.name as agency_name, a.id as agency_id,
        comp.name as company_name
      FROM shipments s
      LEFT JOIN customers c ON s.customer_id=c.id
      LEFT JOIN agencies a ON c.agency_id=a.id
      LEFT JOIN companies comp ON s.company_id=comp.id
      WHERE s.id=?
    `).get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Bulunamadı' });
    const documents = db.prepare('SELECT * FROM documents WHERE shipment_id=? ORDER BY uploaded_at').all(req.params.id);
    const images = db.prepare('SELECT * FROM product_images WHERE shipment_id=? ORDER BY uploaded_at').all(req.params.id);
    res.json({ ...s, documents, images });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shipments', authMiddleware, adminOnly, (req, res) => {
  try {
    const { customer_id, company_id, reference_no = '', shipment_date, description = '', currency = 'USD', invoice_amount, shipping_method = 'CIF', fob_amount, notes = '' } = req.body;
    if (!customer_id || !shipment_date) return res.status(400).json({ error: 'Müşteri ve tarih zorunludur' });
    const r = db.prepare(`
      INSERT INTO shipments (customer_id,company_id,reference_no,shipment_date,description,currency,invoice_amount,shipping_method,fob_amount,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(customer_id, company_id || null, reference_no, shipment_date, description, currency, invoice_amount || null, shipping_method, fob_amount || null, notes);
    res.json({ id: r.lastInsertRowid, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/shipments/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const { customer_id, company_id, reference_no = '', shipment_date, description = '', currency = 'USD', invoice_amount, payment_amount, shipping_method = 'CIF', fob_amount, notes = '' } = req.body;
    let commission_amount = null;
    let status = 'pending';
    if (payment_amount) {
      const cust = db.prepare('SELECT commission_rate FROM customers WHERE id=?').get(customer_id);
      if (cust) {
        commission_amount = (parseFloat(payment_amount) * cust.commission_rate) / 100;
        status = 'paid';
      }
    }
    db.prepare(`
      UPDATE shipments SET customer_id=?,company_id=?,reference_no=?,shipment_date=?,description=?,
        currency=?,invoice_amount=?,payment_amount=?,commission_amount=?,status=?,shipping_method=?,fob_amount=?,notes=?
      WHERE id=?
    `).run(customer_id, company_id || null, reference_no, shipment_date, description, currency,
      invoice_amount || null, payment_amount || null, commission_amount, status, shipping_method, fob_amount || null, notes, req.params.id);
    res.json({ success: true, commission_amount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shipments/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const docs = db.prepare('SELECT filename FROM documents WHERE shipment_id=?').all(req.params.id);
    const imgs = db.prepare('SELECT filename FROM product_images WHERE shipment_id=?').all(req.params.id);
    [...docs, ...imgs].forEach(f => {
      const fp = path.join(uploadsDir, f.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    db.prepare('DELETE FROM shipments WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== DOCUMENTS ====================
app.post('/api/shipments/:id/documents', authMiddleware, adminOnly, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
    const { doc_type, payment_amount } = req.body;
    const shipment_id = parseInt(req.params.id);
    const r = db.prepare(`
      INSERT INTO documents (shipment_id,doc_type,filename,original_name,file_size)
      VALUES (?,?,?,?,?)
    `).run(shipment_id, doc_type, req.file.filename, req.file.originalname, req.file.size);

    if (doc_type === 'payment_receipt' && payment_amount) {
      const row = db.prepare(`
        SELECT s.customer_id, c.commission_rate FROM shipments s
        JOIN customers c ON s.customer_id=c.id WHERE s.id=?
      `).get(shipment_id);
      if (row) {
        const amt = parseFloat(payment_amount);
        const commission = (amt * row.commission_rate) / 100;
        db.prepare('UPDATE shipments SET payment_amount=?,commission_amount=?,status=? WHERE id=?').run(amt, commission, 'paid', shipment_id);
      }
    }
    res.json({ id: r.lastInsertRowid, shipment_id, doc_type, filename: req.file.filename, original_name: req.file.originalname, uploaded_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/documents/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
    if (doc) {
      const fp = path.join(uploadsDir, doc.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== PRODUCT IMAGES ====================
app.post('/api/shipments/:id/images', authMiddleware, adminOnly, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Görsel yüklenmedi' });
    const { description = '' } = req.body;
    const r = db.prepare('INSERT INTO product_images (shipment_id,filename,original_name,description) VALUES (?,?,?,?)').run(req.params.id, req.file.filename, req.file.originalname, description);
    res.json({ id: r.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname, description, uploaded_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/product-images/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const img = db.prepare('SELECT * FROM product_images WHERE id=?').get(req.params.id);
    if (img) {
      const fp = path.join(uploadsDir, img.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      db.prepare('DELETE FROM product_images WHERE id=?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== REPORTS ====================
app.get('/api/reports/customer/:id', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let q = `
      SELECT s.*, comp.name as company_name
      FROM shipments s LEFT JOIN companies comp ON s.company_id=comp.id
      WHERE s.customer_id=?
    `;
    const params = [req.params.id];
    if (start_date) { q += ' AND s.shipment_date>=?'; params.push(start_date); }
    if (end_date) { q += ' AND s.shipment_date<=?'; params.push(end_date); }
    q += ' ORDER BY s.shipment_date DESC';
    const shipments = db.prepare(q).all(...params);
    const customer = db.prepare('SELECT c.*, a.name as agency_name FROM customers c LEFT JOIN agencies a ON c.agency_id=a.id WHERE c.id=?').get(req.params.id);
    const total_commission = shipments.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
    const total_payment = shipments.reduce((sum, s) => sum + (s.payment_amount || 0), 0);
    res.json({ customer, shipments, total_commission, total_payment });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/agency/:id', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const agency = db.prepare('SELECT * FROM agencies WHERE id=?').get(req.params.id);
    if (!agency) return res.status(404).json({ error: 'Acente bulunamadı' });

    const customers = db.prepare(`
      SELECT c.*,
        COUNT(DISTINCT s.id) as shipment_count,
        COALESCE(SUM(s.commission_amount),0) as total_commission,
        COALESCE(SUM(s.payment_amount),0) as total_payment,
        SUM(CASE WHEN s.status='paid' THEN 1 ELSE 0 END) as paid_count
      FROM customers c
      LEFT JOIN shipments s ON s.customer_id=c.id
      WHERE c.agency_id=?
      GROUP BY c.id ORDER BY c.name
    `).all(req.params.id);

    let shipQ = `
      SELECT s.*, c.name as customer_name, c.commission_rate
      FROM shipments s JOIN customers c ON s.customer_id=c.id
      WHERE c.agency_id=?
    `;
    const params = [req.params.id];
    if (start_date) { shipQ += ' AND s.shipment_date>=?'; params.push(start_date); }
    if (end_date) { shipQ += ' AND s.shipment_date<=?'; params.push(end_date); }
    shipQ += ' ORDER BY s.shipment_date DESC';
    const shipments = db.prepare(shipQ).all(...params);

    const total_commission = shipments.reduce((s, r) => s + (r.commission_amount || 0), 0);
    const total_payment = shipments.reduce((s, r) => s + (r.payment_amount || 0), 0);
    const paid_count = shipments.filter(r => r.status === 'paid').length;

    res.json({ agency, customers, shipments, total_commission, total_payment, paid_count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/summary', authMiddleware, (req, res) => {
  try {
    const agencyFilter = req.user.role === 'agency' ? req.user.id : null;
    const aq = agencyFilter ? ' WHERE agency_id=?' : '';
    const sq = agencyFilter ? ' JOIN customers c ON s.customer_id=c.id WHERE c.agency_id=?' : '';
    const p = agencyFilter ? [agencyFilter] : [];
    res.json({
      agencies: agencyFilter ? 1 : db.prepare('SELECT COUNT(*) as c FROM agencies').get().c,
      customers: db.prepare(`SELECT COUNT(*) as c FROM customers${aq}`).get(...p).c,
      shipments: db.prepare(`SELECT COUNT(*) as c FROM shipments s${sq}`).get(...p).c,
      paid: db.prepare(`SELECT COUNT(*) as c FROM shipments s${sq}${agencyFilter ? ' AND' : ' WHERE'} s.status='paid'`).get(...p).c,
      total_commission: db.prepare(`SELECT COALESCE(SUM(s.commission_amount),0) as t FROM shipments s${sq}`).get(...p).t,
      recent_shipments: db.prepare(`
        SELECT s.*, c.name as customer_name, a.name as agency_name
        FROM shipments s
        LEFT JOIN customers c ON s.customer_id=c.id
        LEFT JOIN agencies a ON c.agency_id=a.id
        ${agencyFilter ? 'WHERE c.agency_id=?' : ''}
        ORDER BY s.created_at DESC LIMIT 5
      `).all(...p)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Acente Komisyon Sistemi çalışıyor → http://localhost:${PORT}\n`);
});
