const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Load environment variables from .env file in local/dev environments
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const CLOUD_NAME = "dcv3eqmde";
const API_KEY = "213199444474897";
const API_SECRET = "z0qptwMS1KxJiYb_Z5ssZy39aSo";

// try to derive cloud_name from CLOUDINARY_URL if explicit var missing
function getCloudinaryConfigFromEnv() {
    const cfg = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    };

    const url = process.env.CLOUDINARY_URL;
    if ((!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) && url) {
        // expected format: cloudinary://<api_key>:<api_secret>@<cloud_name>
        const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
        if (m) {
            cfg.api_key = cfg.api_key || m[1];
            cfg.api_secret = cfg.api_secret || m[2];
            cfg.cloud_name = cfg.cloud_name || m[3];
        }
    }
    return cfg;
}

const cloudCfg = getCloudinaryConfigFromEnv();

// If missing critical credentials, skip sync so deploy doesn't fail with "Must supply cloud_name"
if (!cloudCfg.cloud_name || !cloudCfg.api_key || !cloudCfg.api_secret) {
    console.log('No complete Cloudinary credentials found; skipping image sync.'); // non-sensitive
    process.exit(0); // graceful success so prestart won't fail deployment
}

cloudinary.config({
    cloud_name: cloudCfg.cloud_name,
    api_key: cloudCfg.api_key,
    api_secret: cloudCfg.api_secret,
});

const FOLDER = "destinations";
const OUTPUT_FILE = path.join(__dirname, "../src/dest-images.json");

async function fetchCloudinaryImages() {
const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image`;
let nextCursor = undefined;
let allImages = [];

do {
    const params = {
    prefix: `${FOLDER}/`,
    max_results: 100,
    ...(nextCursor && { next_cursor: nextCursor }),
    };

    const response = await axios.get(url, {
    params,
    auth: { username: API_KEY, password: API_SECRET },
    });

    allImages = allImages.concat(response.data.resources);
    nextCursor = response.data.next_cursor;
} while (nextCursor);

return allImages;
}

function normalizeName(publicId) {
// Extracts the file name without folder and extension
const nameWithExt = publicId.split("/").pop();
// Remove last 6 chars if needed (e.g., "_fak9t3")
const baseName = nameWithExt.replace(/\.[^/.]+$/, "");
return baseName.replace(/_/g, " ");
}

(async function main() {
    try {
        const images = await fetchCloudinaryImages();
        const json = images.map(img => ({
    name: normalizeName(img.public_id),
    url: img.secure_url,
    }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(json, null, 2));
    console.log(`Updated ${OUTPUT_FILE} with ${json.length} images.`);
    } catch (err) {
        console.error('Failed to sync Cloudinary images:', err.message || err);
        // Do not crash the start process; exit 0 so the service continues running
        process.exit(0);
    }
})();