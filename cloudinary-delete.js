// This is a Node.js/Express or Next.js API route example.
// Install cloudinary: npm install cloudinary
const express = require('express');
const bodyParser = require('body-parser');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: 'dxvewejox',
  api_key: '331539429927692',
  api_secret: 'Ojde84BbupcTxZWPpUOxKI_B2CU'
});

const app = express();
app.use(bodyParser.json());

app.post('/api/cloudinary/delete', async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) {
    return res.status(400).json({ error: 'Missing publicId' });
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === 'ok') {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: result.result });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Cloudinary delete API running on port ${PORT}`);
});
