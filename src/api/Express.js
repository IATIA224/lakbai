const fs = require('fs');
const path = require('path');

const destImagesPath = path.join(__dirname, '../dest-images.json');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    let newImages = [];
    try {
        newImages = req.body;
        if (!Array.isArray(newImages)) throw new Error('Invalid payload');
        // Read existing images
        let existing = [];
        if (fs.existsSync(destImagesPath)) {
        existing = JSON.parse(fs.readFileSync(destImagesPath, 'utf8'));
        }
        // Filter out duplicates by name and url
        const all = [...existing];
        for (const img of newImages) {
        if (
            img.name &&
            img.url &&
            !all.some(e => e.name === img.name && e.url === img.url)
        ) {
            all.push({ name: img.name, url: img.url });
        }
        }
        // Write back to file
        fs.writeFileSync(destImagesPath, JSON.stringify(all, null, 2), 'utf8');
        res.status(200).json({ added: newImages.length });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};