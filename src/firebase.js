import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAHYtSKJ6KntJNaZhh8JJKQF4Viu50Egns",
  authDomain: "lakbai-ca149.firebaseapp.com",
  projectId: "lakbai-ca149",
  storageBucket: "lakbai-ca149.firebasestorage.app",
  messagingSenderId: "271853458373",
  appId: "1:271853458373:web:fbfec5fdd62d9fe80271ac",
  measurementId: "G-TXEE2C3HJW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { auth, db, rtdb, app };