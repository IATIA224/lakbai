require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const app = express();
const upload = multer(); // memory storage

app.use(express.json({ limit: '8mb' }));
app.use(express.text({ type: ['text/*', 'application/octet-stream'], limit: '8mb' }));

// Build connection string from .env (prefer explicit full URL)
const connectionString =
  process.env.DB_EXTERNAL_URL ||
  process.env.DB_INTERNAL_URL ||
  (process.env.DB_HOST
    ? `postgresql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASS)}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
    : undefined);

if (!connectionString) {
  console.error('Missing Postgres connection info in .env (DB_EXTERNAL_URL or DB_HOST/DB_USER/DB_PASS).');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Simple healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// Upsert a file by name. Accepts:
// - multipart/form-data with "file" field (recommended from browser)
// - application/json body when uploading JSON
// - text/csv (or any text) in raw body for CSV/text
app.put('/api/files/:name', upload.single('file'), async (req, res) => {
  console.log('Upload attempt:', req.params.name, req.file ? req.file.originalname : null);
  const name = req.params.name;
  try {
    let type = 'text';
    let contentJson = null;
    let contentText = null;

    // multipart/form-data upload
    if (req.file) {
      const originalName = req.file.originalname || name;
      const buf = req.file.buffer;
      const txt = buf.toString('utf8');
      // detect JSON vs CSV
      try {
        contentJson = JSON.parse(txt);
        type = 'json';
      } catch (e) {
        contentText = txt;
        // if file ends with .json try to parse
        if (originalName.toLowerCase().endsWith('.json')) {
          try { contentJson = JSON.parse(txt); type='json'; contentText = null; } catch {}
        }
        if (originalName.toLowerCase().endsWith('.csv')) type = 'csv';
      }
    }
    // application/json body
    else if (req.is('application/json')) {
      contentJson = req.body;
      type = 'json';
    }
    // raw text body
    else if (typeof req.body === 'string') {
      const txt = req.body;
      // try JSON parse
      try { contentJson = JSON.parse(txt); type='json'; }
      catch { contentText = txt; }
    } else {
      return res.status(400).json({ error: 'No file or body provided' });
    }

    const client = await pool.connect();
    try {
      const q = `
        INSERT INTO files (name, type, content_json, content_text, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (name) DO UPDATE
          SET type = EXCLUDED.type,
              content_json = EXCLUDED.content_json,
              content_text = EXCLUDED.content_text,
              updated_at = now()
        RETURNING *;
      `;
      const values = [
        name,
        type,
        contentJson ? contentJson : null,
        contentText ? contentText : null,
      ];
      const r = await client.query(q, values);
      return res.json({ ok: true, file: r.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get file content
app.get('/api/files/:name', async (req, res) => {
  const name = req.params.name;
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM files WHERE name = $1', [name]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    return res.json(r.rows[0]);
  } finally {
    client.release();
  }
});

// Delete file
app.delete('/api/files/:name', async (req, res) => {
  const name = req.params.name;
  const client = await pool.connect();
  try {
    const r = await client.query('DELETE FROM files WHERE name = $1 RETURNING *', [name]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true, deleted: r.rows[0] });
  } finally {
    client.release();
  }
});

// Optional: parse CSV stored in "files" table and upsert to fares table
// POST /api/files/:name/parse-fares
app.post('/api/files/:name/parse-fares', async (req, res) => {
  const name = req.params.name;
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM files WHERE name = $1', [name]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'file not found' });
    const row = r.rows[0];
    const csvText = row.content_text;
    if (!csvText) return res.status(400).json({ error: 'file has no CSV text' });

    // parse csv robustly using csv-parse/sync
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true
    });

    await client.query('BEGIN');
    for (const rec of records) {
      // Normalize column names used in your CSV
      const vehicleType = rec['Vehicle Type'] || rec['Vehicle_Type'] || rec['VehicleType'] || rec['Vehicle Type '];
      const subType = rec['Sub-Type'] || rec['Sub Type'] || rec['Sub-Type '];
      const baseRate = rec['Base Rate(First 5 or 4 kilometers)'] ? parseFloat(rec['Base Rate(First 5 or 4 kilometers)']) : null;
      const ratePerKm = rec['Rate per km (₱)'] ? parseFloat(rec['Rate per km (₱)']) : null;
      const perMin = rec['Per Minute Travel time'] ? parseFloat(rec['Per Minute Travel time']) : null;

      const upsert = `
        INSERT INTO fares (vehicle_type, sub_type, base_rate, rate_per_km, per_min, raw)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (vehicle_type, sub_type) DO UPDATE
          SET base_rate = EXCLUDED.base_rate,
              rate_per_km = EXCLUDED.rate_per_km,
              per_min = EXCLUDED.per_min,
              raw = EXCLUDED.raw
        RETURNING *;
      `;
      await client.query(upsert, [vehicleType, subType, baseRate, ratePerKm, perMin, rec]);
    }
    await client.query('COMMIT');
    return res.json({ ok: true, parsed: records.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  } finally {
    client.release();
  }
});

app.post('/api/jeepney_routes', express.json({ limit: '8mb' }), async (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'Missing name or data' });

  try {
    const client = await pool.connect();
    const q = `
      INSERT INTO jeepney_routes (name, data)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const r = await client.query(q, [name, data]);
    client.release();
    res.json({ ok: true, route: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});