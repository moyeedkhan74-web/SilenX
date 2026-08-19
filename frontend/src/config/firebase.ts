import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  inMemoryPersistence, 
  type Auth 
} from 'firebase/auth';

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
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Safe multi-tier persistence chain to handle browser storage quota limits
  setPersistence(auth, indexedDBLocalPersistence)
    .catch(() => setPersistence(auth, browserLocalPersistence))
    .catch(() => setPersistence(auth, browserSessionPersistence))
    .catch(() => setPersistence(auth, inMemoryPersistence))
    .catch((err) => console.warn('[Firebase Auth] Persistence fallback notice:', err));

  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (error) {
  console.warn('Firebase initialization warning:', error);
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig, 'silenx-fallback');
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { app, auth, googleProvider };
