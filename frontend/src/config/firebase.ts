import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA_xV9HkY8S_bSPw_pBaYXefUep-5p1FRg",
  authDomain: "silenx-737a3.firebaseapp.com",
  projectId: "silenx-737a3",
  storageBucket: "silenx-737a3.firebasestorage.app",
  messagingSenderId: "108819293185",
  appId: "1:108819293185:web:c22b4a2655a58c01a34c00",
  measurementId: "G-977PN147XX"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
