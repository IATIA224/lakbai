const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log('[REQ]', { method: req.method, url: req.originalUrl, origin: req.headers.origin });
  next();
});

// Mount Cloudinary routes
app.use('/api', require('./cloudinaryRoutes'));

// Mount email routes (ensure this file exists)
const emailRoutes = require('./emailRoutes');
app.use('/api', emailRoutes);

// Simple health/root routes (also good for Render health checks)
app.get('/_health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.status(200).json({ status: 'API is running', version: '1.0' }));

// log defined routes to help debug
setTimeout(() => {
  try {
    app._router.stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        console.log(`[ROUTE] ${methods} ${layer.route.path}`);
      }
    });
  } catch (e) {
    console.log('[ROUTE] could not enumerate');
  }
}, 1000);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not Found', path: req.originalUrl });
});

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
});

const FRONTEND_URL = process.env.FRONTEND_URL || true;
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Simple request logger to help debug incoming requests
app.use((req, res, next) => {
  console.log('[REQ]', { method: req.method, url: req.originalUrl, origin: req.headers.origin, host: req.headers.host });
  next();
});