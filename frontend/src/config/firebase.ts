import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDrmYCU3YDCDEoJMSmzkPPfnw8N4exMfkk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'silenx-737a3.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'silenx-737a3',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'silenx-737a3.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '108819293185',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:108819293185:web:222ada100395b10ea34c00',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (error) {
  console.warn('Firebase initialization warning:', error);
  app = initializeApp(firebaseConfig, 'silenx-app');
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { app, auth, googleProvider };
