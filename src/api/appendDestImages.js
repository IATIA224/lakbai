const fs = require('fs');
const path = require('path');

const destImagesPath = path.join(__dirname, '../dest-images.json');

function appendDestImages(newImages) {
    let data = [];
    if (fs.existsSync(destImagesPath)) {
        data = JSON.parse(fs.readFileSync(destImagesPath, 'utf8'));
    }
    // Avoid duplicates by name
    const names = new Set(data.map(d => d.name));
    for (const img of newImages) {
        if (!names.has(img.name) && img.url) {
            data.push(img);
            names.add(img.name);
        }
    }
    fs.writeFileSync(destImagesPath, JSON.stringify(data, null, 2), 'utf8');
}


module.exports = appendDestImages;