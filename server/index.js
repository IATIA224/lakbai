const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ Lakbai CMS Server is running successfully');
});

// Mount Cloudinary routes
app.use('/api', require('./cloudinaryRoutes'));

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
});

const updateDestImage = require('./update-dest-image');

// If admin was a separate express app, require it as a router.
// Replace the old separate listen on 10010 with mounting:
const adminApp = require('./admin'); // admin should export an express.Router() or app

// mount admin under /admin (or root) so it is reachable on the same public port
app.use('/admin', adminApp);

// use Render-provided PORT (or fallback)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Main server (with admin) listening on port ${PORT}`);
});
