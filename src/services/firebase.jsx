import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCke3XbnkUjE2eZM4OfxLA9Huls28HwPmc",
  authDomain: "sentinelai-e8705.firebaseapp.com",
  projectId: "sentinelai-e8705",
  storageBucket: "sentinelai-e8705.firebasestorage.app",
  messagingSenderId: "489690170110",
  appId: "1:489690170110:web:429e94292d228897345baf",
  measurementId: "G-6J9Q8ZQYKE"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();