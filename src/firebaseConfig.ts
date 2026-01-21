
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// Fixed: Changed modular firestore import to non-lite version to resolve export issues
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);

export default app;
