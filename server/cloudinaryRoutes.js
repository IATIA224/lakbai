const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('Cloudinary config:', cloudinary.config());

router.post('/api/cloudinary/delete', async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) return res.status(400).json({ error: 'Missing publicId' });
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cloudinary-images - List all JPG images in 'destinations' folder
router.get('/cloudinary-images', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 100,
      resource_type: 'image',
    });
    console.log('Cloudinary result:', result); // <-- Add this line
    const jpgImages = result.resources.filter(img => img.format === 'jpg');
    res.json(jpgImages);
  } catch (err) {
    console.error('Cloudinary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;