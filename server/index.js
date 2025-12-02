const express = require('express');
const admin = require('firebase-admin'); // Make sure this is required
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// --- ADD THIS BLOCK ---
try {
  // 1. Try to load from Render's secret file location
  const serviceAccount = require('/etc/secrets/firebase-service-account.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin Initialized successfully");
} catch (error) {
  console.error("⚠️ Firebase initialization failed. Check if 'firebase-service-account.json' is added to Render Secret Files.");
  console.error(error.message);
}
// --- END ADD BLOCK ---

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ADD THIS: Root route to show server is running
app.get('/', (req, res) => {
  res.send('LakbAI Server is running!');
});

// Mount Cloudinary routes
app.use('/api', require('./cloudinaryRoutes'));

// Mount email routes (ensure this file exists)
const emailRoutes = require('./emailRoutes');
app.use('/api', emailRoutes);

// Quick health check
app.get('/_health', (req, res) => res.json({ ok: true }));

// Configure Cloudinary with your credentials
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.post('/api/cloudinary/delete', async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) return res.status(400).json({ error: 'Missing publicId' });
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
    res.json({ success: true });
  } catch (err) {
    console.error('cloudinary delete error', err && err.message);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

const updateDestImage = require('./update-dest-image');

// Option A — mount the update-dest-image app under a path so you keep a single server
// e.g. all routes defined in update-dest-image will serve under /update-dest-image
app.use('/update-dest-image', updateDestImage.app);

// Option B — if you want update-dest-image to run as a separate server, start it on a different port
// updateDestImage.startServer(Number(process.env.UPDATE_IMAGE_PORT || 4002));

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
});