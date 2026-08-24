import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
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
import { updateSocketToken } from './services/socket';
import { livekitService } from './services/livekit';
import { authenticateWithGoogleBackend } from './services/authApi';
import { initializeNativePush, isNativePushSupported } from './services/nativePush';
import { initializePushNotifications } from './services/pushNotification';
import InAppNotificationBanner from './components/InAppNotificationBanner';
import DeepLinkHandler from './components/DeepLinkHandler';
import type { UserStatus } from './types';
import './App.css';
import { ThemeProvider } from './theme/ThemeContext';
import { CryptoProvider, useCrypto } from './context/CryptoContext';

const BootLoadingView = () => (
  <div className="app-loading-screen" role="status" aria-live="polite">
    <div className="app-loading-backdrop" aria-hidden="true">
      <div className="app-loading-orb orb-1" />
      <div className="app-loading-orb orb-2" />
      <div className="app-loading-orb orb-3" />
    </div>

    <div className="app-loading-card">
      <img className="app-loading-logo" src="/silenX-logo.png" alt="SilenX logo" />
      <div className="app-loading-content">
        <span className="app-loading-eyebrow">Secure Workspace</span>
        <h1>Welcome to SlienX</h1>
        <p>Preparing your workspace...</p>
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

  return (
    <ThemeProvider>
      <CryptoProvider>
        <AppInner
          login={login}
          logout={logout}
          setInitialized={setInitialized}
          initialized={initialized}
        />
      </CryptoProvider>
    </ThemeProvider>
  );
}

let activeAuthPromise: Promise<any> | null = null;

function AppInner({
  login,
  logout,
  setInitialized,
  initialized,
}: {
  login: (user: any, token: string) => void;
  logout: () => void;
  setInitialized: (value: boolean) => void;
  initialized: boolean;
}) {
  const { initializeKeys } = useCrypto();

  /**
   * Register push notifications once a session exists.
   * - Native (Android/iOS): creates the high-importance notification channel,
   *   prompts POST_NOTIFICATIONS, registers with FCM and syncs the native
   *   token to the backend.
   * - Web: Firebase Messaging + service worker for desktop push.
   */
  const triggerPushInitialization = () => {
    if (isNativePushSupported()) {
      initializeNativePush().catch((err) => console.warn('[App] Native push init error:', err));
    } else {
      initializePushNotifications().catch((err) => console.warn('[App] Web push init error:', err));
    }
  };

useEffect(() => {
    // Instant boot fast-path: if a session is already stored locally, show the
    // UI immediately while the auth listener refreshes tokens in the
    // background — no spinner wait for returning users.
    const currentStoreAtBoot = useAuthStore.getState();
    if (currentStoreAtBoot.user && currentStoreAtBoot.token) {
      setInitialized(true);
    }

    const safetyTimer = setTimeout(() => {
      setInitialized(true);
    }, 400); // Reduced from 1500ms to 400ms max fallback

    const finalizeBoot = () => {
      clearTimeout(safetyTimer);
      setInitialized(true);
    };

    if (!auth) {
      finalizeBoot();
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (firebaseUser) {
            try {
              const idToken = await Promise.race([
                firebaseUser.getIdToken(false), // Use false to avoid triggering unnecessary socket reconnect loops
                new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Firebase token request timed out')), 30000);
                }),
              ]);

              if (!activeAuthPromise) {
                activeAuthPromise = authenticateWithGoogleBackend(idToken).finally(() => {
                  activeAuthPromise = null;
                });
              }

              const body = await Promise.race([
                activeAuthPromise,
                new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Backend startup timed out')), 30000);
                }),
              ]);

              const serverUser = body.user;

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

              await initializeKeys();

              try {
                const socket = connectSocket(idToken);
                livekitService.initialize(socket);
              } catch (error) {
                console.warn('Socket connection failed:', error);
              }

              // Register push notifications (Native Capacitor on Android/iOS,
              // Firebase Web fallback on Desktop browser).
              triggerPushInitialization();
            } catch (error) {
              console.warn('[App] Backend startup slow or unavailable, preserving existing session:', error);
              // âš ï¸ DO NOT sign out here â€” backend may be cold-starting (Render free tier).
              // If the user already has a valid session in the store, keep it alive.
              const currentStore = useAuthStore.getState();
              if (currentStore.user && currentStore.token) {
                // Reuse existing session: reinit crypto + socket with stored token
                initializeKeys().catch(() => {});
                try {
                  const socket = connectSocket(currentStore.token);
                  livekitService.initialize(socket);
                } catch (socketErr) {
                  console.warn('[App] Socket reconnect failed during fallback:', socketErr);
                }
                triggerPushInitialization();
              } else {
                // No stored session at all â€” only then log out
                logout();
              }
            }
          } else {
            // If Firebase is null, do NOT wipe user session if user is logged in via store
            const currentStore = useAuthStore.getState();
            if (!currentStore.user && !currentStore.token) {
              logout();
            } else if (currentStore.user && currentStore.token) {
              // Restore crypto & socket for existing session
              initializeKeys().catch(() => {});
              try {
                const socket = connectSocket(currentStore.token);
                livekitService.initialize(socket);
              } catch (err) {
                console.warn('Socket reconnect notice:', err);
              }
              triggerPushInitialization();
            }
          }
        } finally {
          finalizeBoot();
        }
      },
      (error) => {
        console.warn('[App] Auth state error:', error);
        finalizeBoot();
      }
    );

    // ðŸ†• Add onIdTokenChanged listener for automatic token refresh
    const unsubToken = onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          const freshToken = await user.getIdToken();
          const currentToken = useAuthStore.getState().token;
          if (freshToken !== currentToken) {
            useAuthStore.getState().setToken(freshToken);
            console.log('[Auth] Refreshed Firebase ID token in store');
          }
          // Keep the ACTIVE socket handshake credential in sync so reconnects
          // never fail with UNAUTHORIZED after the 1-hour token rotation.
          updateSocketToken(freshToken);
        } catch (err) {
          console.warn('[Auth] Failed to update ID token:', err);
        }
      }
    });

    return () => {
      unsubscribe();
      unsubToken();
      clearTimeout(safetyTimer);
    };
  }, [login, logout, setInitialized, initializeKeys]);

  if (!initialized) {
    return <BootLoadingView />;
  }

  return (
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
        <InAppNotificationBanner />
        <DeepLinkHandler />
      </div>
    </BrowserRouter>
  );
}

export default App;




