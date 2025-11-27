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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/api/echo', (req, res) => {
  console.log('[echo] headers:', req.headers);
  console.log('[echo] body:', req.body);
  res.json({ ok: true, headers: req.headers, body: req.body });
});

// health + quick test route
app.get('/health', (req, res) => res.json({ ok: true, pid: process.pid, started: new Date().toISOString() }));
app.get('/api/ping', (req, res) => res.json({ pong: true }));

// mount routes
app.use('/api', require('./cloudinaryRoutes'));
app.use('/api', require('./emailRoutes'));

// Global error handler (logs stack)
app.use((err, req, res, next) => {
  console.error('[global-error] ', err);
  res.status(500).json({ error: 'Server error' });
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