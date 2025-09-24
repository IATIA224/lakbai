const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcv3eqmde',
    api_key: process.env.CLOUDINARY_API_KEY || '213199444474897',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'z0qptwMS1KxJiYb_Z5ssZy39aSo',
});

    // POST /api/cloudinary/delete
    router.post('/delete', async (req, res) => {
    const { publicId } = req.body;
    if (!publicId) {
        return res.status(400).json({ error: 'Missing publicId' });
    }
    try {
        await cloudinary.uploader.destroy(publicId, { invalidate: true });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;