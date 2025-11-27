const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// Use FRONTEND_URL env var to restrict CORS (or use '*' while debugging)
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log('[REQ]', { method: req.method, url: req.originalUrl, origin: req.headers.origin, host: req.headers.host });
  next();
});

// Mount routes BEFORE listen
app.use('/api', require('./cloudinaryRoutes'));
app.use('/api', require('./emailRoutes'));

// Simple health/root routes (good for Render health checks)
app.get('/_health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.status(200).json({ status: 'API is running', version: '1.0' }));

// Debug route to list available routes (handy if you cannot use shell)
app.get('/api/_routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        routes.push({ path: layer.route.path, methods });
      }
    });
    res.json({ ok: true, routes });
  } catch (err) {
    res.json({ ok: false, routes: [], error: String(err) });
  }
});

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