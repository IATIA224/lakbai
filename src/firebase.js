import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // Add this import
import { getApp } from "firebase/app"; // Add temporarily for debug

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
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app); // Add this line

console.log("Firebase project:", getApp().options.projectId); // Debug line

export { auth, db, rtdb }; // Export rtdb