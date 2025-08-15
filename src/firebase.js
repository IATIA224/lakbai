import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAHYtSKJ6KntJNaZhh8JJKQF4Viu50Egns",
  authDomain: "lakbai-ca149.firebaseapp.com",
  projectId: "lakbai-ca149",
  storageBucket: "lakbai-ca149.firebasestorage.app",
  messagingSenderId: "271853458373",
  appId: "1:271853458373:web:fbfec5fdd62d9fe80271ac",
  measurementId: "G-TXEE2C3HJW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Improve error handling for auth persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Auth persistence set to LOCAL');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User authenticated:', user.uid);
      } else {
        console.log('User signed out');
      }
    });

    // Cleanup listener on error
    return () => unsubscribe();
  })
  .catch((error) => {
    console.error('Auth persistence error:', error.code, error.message);
  });

// Enhanced Firestore persistence with retry logic
const enablePersistence = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await enableIndexedDbPersistence(db);
      console.log('Firestore persistence enabled');
      return;
    } catch (err) {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence enabled in first tab only');
        break;
      } else if (err.code === 'unimplemented') {
        console.warn('Browser doesn\'t support persistence');
        break;
      } else if (i === retries - 1) {
        console.error('Persistence failed after retries:', err);
      } else {
        console.log(`Retrying persistence enable... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
};

enablePersistence();

// Enhanced getCurrentUser with timeout
const getCurrentUser = (timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Auth state check timed out'));
    }, timeout);

    const unsubscribe = onAuthStateChanged(auth, 
      user => {
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      },
      error => {
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      }
    );
  });
};

export { db, auth, storage, getCurrentUser };
