const express = require('express');
const cors = require('cors');
const path = require('path');
<<<<<<< HEAD
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
=======
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize Firebase Admin
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json'); // You need this file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
<<<<<<< HEAD
=======
app.use(express.urlencoded({ extended: true }));
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1

// Mount Cloudinary routes
app.use('/api', require('./cloudinaryRoutes'));

<<<<<<< HEAD
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
        res.status(500).json({ error: 'Failed to delete image' });
    }
=======
// Mount email routes
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
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
});

const updateDestImage = require('./update-dest-image');

<<<<<<< HEAD
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Admin API listening on http://localhost:${PORT}`);
=======
// Option A — mount the update-dest-image app under a path so you keep a single server
// e.g. all routes defined in update-dest-image will serve under /update-dest-image
app.use('/update-dest-image', updateDestImage.app);

// Option B — if you want update-dest-image to run as a separate server, start it on a different port
// updateDestImage.startServer(Number(process.env.UPDATE_IMAGE_PORT || 4002));

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}`);
>>>>>>> f1d6feb7a9f1cc032ac6cc07aa0a7a9db71801c1
});