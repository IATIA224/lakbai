const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const axios = require('axios');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcv3eqmde',
    api_key: process.env.CLOUDINARY_API_KEY || '213199444474897',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'z0qptwMS1KxJiYb_Z5ssZy39aSo',
});

// Use config values for axios call
const CLOUD_NAME = cloudinary.config().cloud_name;
const API_KEY = cloudinary.config().api_key;
const API_SECRET = cloudinary.config().api_secret;

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

router.get('/cloudinary-images', async (req, res) => {
    const folder = 'destinations';
    try {
        const response = await axios.get(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image`,
            {
                auth: { username: API_KEY, password: API_SECRET },
                params: { prefix: folder, max_results: 100 }
            }
        );
        // Filter for jpg only
        const jpgImages = response.data.resources.filter(img => img.format === 'jpg');
        res.json(jpgImages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;