import destImages from "./dest-images.json";

// Use the static JSON file for images
export function fetchCloudinaryImages() {
    return Promise.resolve(destImages);
}

// Helper to get image URL by destination name (case-insensitive, spaces/underscores ignored, last 6 chars ignored)
export function getImageForDestination(images, destinationName) {
    if (!destinationName || !images?.length) return null;
    const norm = s => s.toLowerCase().replace(/[\s_]+/g, "");
    const destNorm = norm(destinationName);
    const found = images.find(img => {
        let imgName = img.name;
        // Remove last 6 chars if they are a random suffix (e.g., "_fak9t3")
        if (imgName.length > 6 && imgName.match(/_[a-z0-9]{6}$/i)) {
            imgName = imgName.slice(0, -7); // remove underscore + 6 chars
        }
        return norm(imgName) === destNorm;
    });
    return found ? found.url : null;
}