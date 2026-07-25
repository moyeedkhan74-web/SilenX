import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatsPage from './pages/ChatsPage';
import ContactsPage from './pages/ContactsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import CallsPage from './pages/CallsPage';
import CallOverlay from './components/CallOverlay';
import { auth } from './config/firebase';
import { useAuthStore } from './store/authStore';
import { normalizeUid } from './config/webrtc-config';
import { connectSocket } from './services/socket';
import { webrtcService } from './services/webrtc';
import { authenticateWithGoogleBackend } from './services/authApi';
import type { UserStatus } from './types';
import './App.css';
import { ThemeProvider } from './theme/ThemeContext';

const BootLoadingView = () => (
  <div className="app-loading-screen" role="status" aria-live="polite">
    <div className="app-loading-backdrop" aria-hidden="true">
      <div className="app-loading-orb orb-1" />
      <div className="app-loading-orb orb-2" />
      <div className="app-loading-orb orb-3" />
    </div>

    <div className="app-loading-card">
      <img className="app-loading-logo" src="/slienx-logo.png" alt="SilenX logo" />
      <div className="app-loading-content">
        <span className="app-loading-eyebrow">Secure Workspace</span>
        <h1>Welcome to SlienX</h1>
        <p>Connecting your private space with a smooth, secure experience.</p>
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialized } = useAuthStore();

  if (!initialized) {
    return <BootLoadingView />;
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
  const initialized = useAuthStore((state) => state.initialized);

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
            const socket = connectSocket(idToken);
            webrtcService.initialize(socket);
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

  if (!initialized) {
    return <BootLoadingView />;
  }

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
              <Route path="calls" element={<CallsPage />} />
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
