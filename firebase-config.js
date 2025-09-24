// firebase-config.js (place this in your project root, same level as package.json)
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBx7VEUMGTD1Z0pdBTApd3QLV5sQz9IEqw",
  authDomain: "booking-system-8f552.firebaseapp.com",
  projectId: "booking-system-8f552",
  storageBucket: "booking-system-8f552.firebasestorage.app",
  messagingSenderId: "148400507031",
  appId: "1:148400507031:web:9c6be3cd209375b436c1d2",
  databaseURL:"https://booking-system-8f552-default-rtdb.asia-southeast1.firebasedatabase.app/",
  measurementId: "G-N9WYSGZEBT"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const database = getDatabase(app);
// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);



export default app;