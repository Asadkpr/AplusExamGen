
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, setLogLevel } from "firebase/firestore";

// Suppress internal SDK console.error spam on transient backoff / quota limits
// so service-level try/catch and local cache fallbacks handle it cleanly
try {
  setLogLevel('silent');
} catch (_) {}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYwWjiomC3k-K-2312BsVFbx9kqqgaujU",
  authDomain: "aplus-examgen.firebaseapp.com",
  projectId: "aplus-examgen",
  storageBucket: "aplus-examgen.firebasestorage.app",
  messagingSenderId: "907492646444",
  appId: "1:907492646444:web:a0c3117fa450e8e0db7b89",
  measurementId: "G-XD0NB6K86D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and Export Services
export const auth = getAuth(app);

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

export default app;

