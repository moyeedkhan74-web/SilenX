import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Clock3, Layers3 } from 'lucide-react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { connectSocket } from '../services/socket';
import { normalizeUid } from '../config/webrtc-config';
import { authenticateWithGoogleBackend } from '../services/authApi';
import type { UserStatus } from '../types';
import './LoginPage.css';

const isMobileDevice = () => {
  return typeof navigator !== 'undefined' && 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Developer Bypass Login State
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devName, setDevName] = useState('');

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      setError('Google sign-in is not configured. Add your Firebase environment values.');
      return;
    }

    setLoading(true);
    setError(null);

    const isMobile = isMobileDevice();

    if (isMobile) {
      try {
        setStatusMessage('Redirecting to Google sign-in...');
        await signInWithRedirect(auth, googleProvider);
        return;
      } catch (err: any) {
        console.error('[Login] Redirect initiation failed, trying popup:', err);
      }
    }

    try {
      setStatusMessage('Opening sign-in window...');
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      setStatusMessage('Authenticating secure workspace...');
      let body;
      try {
        body = await authenticateWithGoogleBackend(idToken, (msg) => setStatusMessage(msg));
      } catch (backendErr: any) {
        await auth.signOut();
        setError(backendErr?.message || 'Backend server unavailable. Please try again.');
        return;
      }

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
        },
        idToken
      );

      try {
        connectSocket(idToken);
      } catch (err) {
        console.warn('Socket registration failed', err);
      }

      navigate('/');
    } catch (err: any) {
      console.error('[Login] Error:', err);
      // If popup blocker blocked the popup, fallback immediately to redirect
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-by-user' || !isMobile) {
        try {
          setStatusMessage('Popup blocked or closed. Redirecting instead...');
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setError(redirectErr?.message || 'Redirect failed.');
        }
      } else {
        setError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devName.trim()) return;

    setLoading(true);
    setError(null);
    setStatusMessage('Preparing private secure workspace...');

    try {
      const trimmedName = devName.trim();
      const mockId = `dev_${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;
      const idToken = `dev_token_${mockId}_${encodeURIComponent(trimmedName)}`;

      const body = await authenticateWithGoogleBackend(idToken, (msg) => setStatusMessage(msg));
      const serverUser = body.user;

      login(
        {
          id: serverUser.id,
          uid: normalizeUid(serverUser.uid || serverUser.id),
          email: serverUser.email || '',
          displayName: serverUser.displayName || trimmedName,
          avatarUrl: serverUser.avatarUrl || null,
          status: (serverUser.status as UserStatus) || 'online',
          lastSeen: new Date().toISOString(),
          bio: serverUser.bio || 'Developer Demo Account',
        },
        idToken
      );

      try {
        connectSocket(idToken);
      } catch (err) {
        console.warn('Socket registration failed', err);
      }

      navigate('/');
    } catch (err: any) {
      console.error('[Dev Login] Error:', err);
      setError(err?.message || 'Developer login failed.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="login-page">
      {loading ? (
        <div className="login-auth-overlay" role="status" aria-live="polite">
          <div className="login-auth-card">
            <img className="login-auth-logo" src="/slienx-logo.png" alt="SilenX logo" />
            <h2>Secure access</h2>
            <p>{statusMessage || 'Verifying your Google account and preparing your private workspace.'}</p>
          </div>
        </div>
      ) : null}

      <div className="aurora" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          <span>SlienX</span>
        </div>

        <nav className="navlinks" aria-label="Primary navigation">
          <a href="#">Features</a>
          <a href="#">Security</a>
          <a href="#">Download</a>
        </nav>
      </header>

      <main className="hero">
        <section className="hero-copy">
          <span className="eyebrow">Now on web, desktop &amp; mobile</span>
          <h2>Conversations that stay yours.</h2>
          <p>
            SlienX pairs end-to-end encrypted messaging with crystal-clear calls, so what you say stays between you and the people you're talking to — nobody else.
          </p>

          <div className="feature-list">
            <div className="feature">
              <div className="feature-icon">
                <Lock size={18} />
              </div>
              <div className="feature-text">
                <h3>Encrypted by default</h3>
                <p>Every message and call is protected before it leaves your device.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <Clock3 size={18} />
              </div>
              <div className="feature-text">
                <h3>Set up in seconds</h3>
                <p>Sign in with your Google account — no phone number, no new password.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <Layers3 size={18} />
              </div>
              <div className="feature-text">
                <h3>One account, every device</h3>
                <p>Pick up the same conversation on your phone, tablet, or laptop.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <img className="mark" src="/slienx-logo.png" alt="SilenX logo" />
          <h1>Sign in</h1>
          <p className="tagline">Continue with your Google account to get started.</p>

          <button
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            id="google-login-button"
          >
            {loading && !showDevLogin ? (
              <span className="login-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.27A12 12 0 0 0 0 12c0 1.93.46 3.76 1.27 5.37z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
              </svg>
            )}
            <span>{statusMessage && !showDevLogin ? statusMessage : 'Continue with Google'}</span>
          </button>

          <div className="login-divider">
            <span>or</span>
          </div>

          {!showDevLogin ? (
            <button
              type="button"
              className="dev-toggle-btn"
              onClick={() => setShowDevLogin(true)}
              disabled={loading}
            >
              Sign in with Demo Account
            </button>
          ) : (
            <form onSubmit={handleDevLogin} className="dev-login-form">
              <div className="dev-input-group">
                <input
                  type="text"
                  placeholder="Enter Display Name (e.g., Alice, Bob)"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  maxLength={20}
                  required
                  disabled={loading}
                />
              </div>
              <div className="dev-btn-group">
                <button type="submit" className="dev-submit-btn" disabled={loading}>
                  {loading && showDevLogin ? (
                    <span className="login-spinner" style={{ borderTopColor: '#ffffff' }} />
                  ) : (
                    'Enter Secure Chat'
                  )}
                </button>
                <button
                  type="button"
                  className="dev-cancel-btn"
                  onClick={() => {
                    setShowDevLogin(false);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {statusMessage ? (
            <div className="status">
              {statusMessage}
            </div>
          ) : null}

          <div className="error" id="errorMsg">
            {error}
          </div>

          <div className="foot">By continuing, you agree to SlienX's Terms &amp; Privacy Policy.</div>
        </section>
      </main>

      <footer className="footer">
        <span>© 2026 SlienX. All rights reserved.</span>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Help Center</a>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
