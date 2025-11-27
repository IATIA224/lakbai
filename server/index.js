const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Cloudinary routes
app.use('/api', require('./cloudinaryRoutes'));

// Mount email routes (ensure emailRoutes.js exports an Express Router)
app.use('/api', require('./emailRoutes'));

// Health check for quick testing on Render
app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
});