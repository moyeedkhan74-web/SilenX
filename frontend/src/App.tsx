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
import { normalizeUid } from './config/webrtc-config';
import { connectSocket } from './services/socket';
import { authenticateWithGoogleBackend } from './services/authApi';
import type { UserStatus } from './types';
import './App.css';
import { ThemeProvider } from './theme/ThemeContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="app-loading-screen" role="status" aria-live="polite">
        <div className="app-loading-backdrop" aria-hidden="true">
          <div className="app-loading-orb orb-1" />
          <div className="app-loading-orb orb-2" />
          <div className="app-loading-orb orb-3" />
        </div>

        <div className="app-loading-card">
          <div className="app-loading-logo">SX</div>
          <div className="app-loading-content">
            <span className="app-loading-eyebrow">Secure Workspace</span>
            <h1>Preparing your SlienX experience…</h1>
            <p>Syncing your secure conversations, calls, and identity.</p>
            <div className="app-loading-bar" aria-hidden="true">
              <span className="app-loading-bar-fill" />
            </div>
            <div className="app-loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
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
          const body = await authenticateWithGoogleBackend(idToken);
          const serverUser = body.user;

          // Store the Firebase ID token as our app token; it is refreshed by Firebase automatically
          login(
            {
              id: serverUser.id,
              uid: normalizeUid(serverUser.uid || serverUser.id),
              email: serverUser.email || '',
              displayName: serverUser.displayName || 'Secure User',
              avatarUrl: serverUser.avatarUrl || null,
              status: (serverUser.status as UserStatus) || 'online',
              lastSeen: new Date().toISOString(),
              bio: serverUser.bio || 'Signed in with Google',
              showOnlineStatus: serverUser.showOnlineStatus !== false,
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
