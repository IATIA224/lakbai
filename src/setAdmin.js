import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

const userId = 'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2'; // Your user ID

async function setAdminStatus() {
try {
    await setDoc(doc(db, 'users', userId), {
    isAdmin: true,
    role: 'admin'
    }, { merge: true });
    console.log('Successfully set admin status!');
} catch (error) {
    console.error('Error setting admin status:', error);
}
}

setAdminStatus();
