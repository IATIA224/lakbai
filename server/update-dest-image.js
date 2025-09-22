const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());

const DEST_IMAGES_PATH = path.join(__dirname, "../src/dest-images.json");

app.post("/api/update-dest-image", (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: "Missing name or url" });

  let images = [];
  if (fs.existsSync(DEST_IMAGES_PATH)) {
    images = JSON.parse(fs.readFileSync(DEST_IMAGES_PATH, "utf8"));
  }
  // Remove existing entry with same name
  images = images.filter(img => img.name !== name);
  images.push({ name, url });

  fs.writeFileSync(DEST_IMAGES_PATH, JSON.stringify(images, null, 2));
  res.json({ success: true });
});

app.listen(4000, () => console.log("Update dest-image API running on port 4000"));