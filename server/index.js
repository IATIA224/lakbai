const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

app.use(morgan('tiny'));

// CORS + preflight
app.use(cors({
  origin: 'https://lakbai.onrender.com',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());

// fallback headers and options handler
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://lakbai.onrender.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf && buf.toString('utf8'); }
}));

// convert JSON parse errors to JSON responses
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('[index] JSON parse failed', err.message, 'raw:', req.rawBody?.slice(0, 400));
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next(err);
});

// Global error handler: log stack & return JSON
app.use((err, req, res, next) => {
  console.error('[global error]', err && (err.stack || err.message || err));
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// log routes for debugging
setTimeout(() => {
  if (app._router && app._router.stack) {
    console.log('Registered routes:');
    app._router.stack.forEach((r) => {
      if (r.route && r.route.path) {
        console.log(Object.keys(r.route.methods).map(m => m.toUpperCase()).join(',') + ' ' + r.route.path);
      }
    });
  }
}, 1000);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));