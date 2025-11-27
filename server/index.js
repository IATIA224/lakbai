const express = require('express');
const cors = require('cors');
const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://lakbai.onrender.com"; // frontend Render URL

app.use(express.json());
app.use(cors({ origin: FRONTEND_URL })); // or origin: true for all (not for prod)

// mount your API routes
app.use('/api', require('./emailRoutes'));
app.use('/api', require('./cloudinaryRoutes'));

// health route
app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));