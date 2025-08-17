import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getApp } from "firebase/app";

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
const rtdb = getDatabase(app); // Add this line

console.log("Firebase project:", getApp().options.projectId); // Debug line

export { db, auth, storage, getCurrentUser, rtdb };
