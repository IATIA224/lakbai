// This script should be run periodically (e.g., once a day) to update the
// topRatedDestinations collection in Firestore.

// It uses the GOOGLE_APPLICATION_CREDENTIALS environment variable to find your
// Firebase service account key file. Make sure this is set in your .env file.

// Example of how to run:
// npm run update-top-rated

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  initializeApp();
} catch (e) {
  console.error('Could not initialize Firebase Admin SDK.');
  console.error('Please make sure you have a serviceAccountKey.json file and that your .env file has a GOOGLE_APPLICATION_CREDENTIALS variable pointing to it.');
  console.error(e);
  process.exit(1);
}

const db = getFirestore();

async function updateTopRatedDestinations() {
  console.log('Starting to update top rated destinations...');

  try {
    const destSnap = await db.collection('destinations').get();
    const destinations = destSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Found ${destinations.length} total destinations.`);

    // Fetch ratings for each destination
    const rated = await Promise.all(destinations.map(async (dest) => {
      const ratingsSnap = await db.collection('destinations').doc(dest.id).collection('ratings').get();
      let sum = 0;
      let count = 0;
      ratingsSnap.forEach(r => {
        const v = Number(r.data()?.value) || 0;
        if (v > 0) {
          sum += v;
          count += 1;
        }
      });
      const avg = count ? sum / count : 0;
      return { ...dest, avgRating: avg, ratingCount: count };
    }));

    // Sort by avgRating desc, then ratingCount desc
    rated.sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      return b.ratingCount - a.ratingCount;
    });

    const top10 = rated.slice(0, 10);

    console.log('Top 10 destinations calculated:');
    top10.forEach((d, i) => {
      console.log(`${i + 1}. ${d.name} (Rating: ${d.avgRating.toFixed(2)}, Count: ${d.ratingCount})`);
    });

    // Update the topRatedDestinations collection
    const batch = db.batch();
    const topRatedCol = db.collection('topRatedDestinations');

    // First, delete existing documents in the collection to ensure a clean slate
    const existingDocsSnap = await topRatedCol.get();
    existingDocsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Then, add the new top 10
    top10.forEach((dest) => {
      const { id, ...destData } = dest;
      const docRef = db.collection('topRatedDestinations').doc(id);
      batch.set(docRef, destData);
    });

    await batch.commit();

    console.log('Successfully updated topRatedDestinations collection in Firestore.');

  } catch (error) {
    console.error('Error updating top rated destinations:', error);
    process.exit(1);
  }
}

updateTopRatedDestinations().then(() => {
  console.log('Script finished.');
  process.exit(0);
}).catch(() => process.exit(1));
