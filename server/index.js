const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Mount Cloudinary routes
app.use(require('./cloudinaryRoutes'));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Admin API listening on http://localhost:${PORT}`);
});
