import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatsPage from './pages/ChatsPage';
import ContactsPage from './pages/ContactsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import CallOverlay from './components/CallOverlay';
import { auth } from './config/firebase';
import { useAuthStore } from './store/authStore';
import { API_URL, normalizeUid } from './config/webrtc-config';
import { connectSocket } from './services/socket';
import './App.css';
import { ThemeProvider } from './theme/ThemeContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialized } = useAuthStore();

  if (!initialized) {
    return <div className="app-loading">Loading your secure workspace…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  useEffect(() => {
    if (!auth) {
      setInitialized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        try {
          const payload = {
            googleId: firebaseUser.providerData?.[0]?.uid || firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            avatar: firebaseUser.photoURL,
          };
          const resp = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (resp.ok) {
            const body = await resp.json();
            const serverUser = body.user;
            const serverToken = body.token;
            login(
              {
                id: serverUser.id,
                uid: normalizeUid(serverUser.uid || serverUser.id),
                email: serverUser.email || '',
                displayName: serverUser.displayName || 'Secure User',
                avatarUrl: serverUser.avatarUrl || null,
                status: serverUser.status || 'online',
                lastSeen: new Date().toISOString(),
                bio: serverUser.bio || 'Signed in with Google',
              },
              serverToken
            );
            try {
              const socket = connectSocket();
              socket.emit('register', { userId: serverUser.id });
            } catch (error) {
              console.warn('Socket registration failed:', error);
            }
          } else {
            login(
              {
                id: firebaseUser.uid,
                uid: normalizeUid(firebaseUser.uid),
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || 'Secure User',
                avatarUrl: firebaseUser.photoURL || null,
                status: 'online',
                lastSeen: new Date().toISOString(),
                bio: 'Signed in with Google',
              },
              token
            );
          }
        } catch (error) {
          console.warn('Backend auth failed:', error);
          login(
            {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Secure User',
              avatarUrl: firebaseUser.photoURL || null,
              status: 'online',
              lastSeen: new Date().toISOString(),
              bio: 'Signed in with Google',
            },
            token
          );
        }
      } else {
        // Only logout if not already authenticated (e.g. via dev bypass login)
        const currentState = useAuthStore.getState();
        if (!currentState.isAuthenticated) {
          logout();
        }
      }
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [login, logout, setInitialized]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/chats" replace />} />
              <Route path="chats" element={<ChatsPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>

          <CallOverlay />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
