const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

// Configure via environment variables
// Set: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dxvewejox',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.post(['/admin/api/cloudinary/delete', '/api/cloudinary/delete'], async (req, res) => {
  try {
    const { publicId, publicIds } = req.body || {};
    if (!publicId && (!Array.isArray(publicIds) || publicIds.length === 0)) {
      return res.status(400).json({ error: 'Missing publicId or publicIds[]' });
    }

    if (Array.isArray(publicIds) && publicIds.length) {
      const result = await cloudinary.api.delete_resources(publicIds);
      return res.json({ success: true, result });
    }

    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok' && result.result !== 'not_found') {
      // not_found is safe to treat as success for idempotency
      return res.status(500).json({ error: result.result || 'Delete failed' });
    }
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
