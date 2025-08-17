const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Replace this with your Firebase Auth user ID
const userId = 'YOUR_USER_ID';

async function setUserAsAdmin() {
  try {
    await db.collection('users').doc(userId).set({
      isAdmin: true,
      role: 'admin'
    }, { merge: true });
    console.log('Successfully set user as admin!');
  } catch (error) {
    console.error('Error setting admin role:', error);
  }
  process.exit();
}

setUserAsAdmin();
