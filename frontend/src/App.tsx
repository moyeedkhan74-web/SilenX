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
        try {
          // Always obtain a fresh token — getIdToken(true) forces a refresh
          const idToken = await firebaseUser.getIdToken(/* forceRefresh */ false);

          const resp = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (!resp.ok) {
            // Server rejected the token (401/503) — sign out and force re-login
            console.error('[App] Backend rejected token, signing out');
            await auth!.signOut();
            logout();
            setInitialized(true);
            return;
          }

          const body = await resp.json();
          const serverUser = body.user;

          // Store the Firebase ID token as our app token; it is refreshed by Firebase automatically
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
            idToken
          );

          // Connect socket with the Firebase ID token for server-side verification
          try {
            connectSocket(idToken);
          } catch (error) {
            console.warn('Socket connection failed:', error);
          }
        } catch (error) {
          console.error('[App] Auth flow failed:', error);
          await auth!.signOut().catch(() => {});
          logout();
        }
      } else {
        logout();
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
