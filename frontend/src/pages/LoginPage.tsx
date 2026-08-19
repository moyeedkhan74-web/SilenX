import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Clock3, Layers3 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { connectSocket } from '../services/socket';
import { normalizeUid } from '../config/webrtc-config';
import { authenticateWithGoogleBackend } from '../services/authApi';
import type { UserStatus } from '../types';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Safe token storage helper with QuotaExceededError handling
  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.warn('[Storage] Quota exceeded. Cleaning up non-essential cache...');
        // Clear non-critical keys to free space
        Object.keys(localStorage).forEach((k) => {
          if (!k.startsWith('firebase:authUser') && !k.startsWith('auth-storage')) {
            localStorage.removeItem(k);
          }
        });
        try {
          localStorage.setItem(key, value);
        } catch (retryErr) {
          sessionStorage.setItem(key, value);
        }
      }
    }
  };

  // Initialize safe storage on component mount
  useEffect(() => {
    // Set up safe storage - try localStorage, fall back to sessionStorage on quota exceeded
    const testKey = '__silenx_storage_test__';
    safeSetItem(testKey, 'test_value');
    // Cleanup test key
    try { localStorage.removeItem(testKey); } catch {}
  }, []);

useEffect(() => {
    try {
      GoogleAuth.initialize({
        clientId: '108819293185-ij6ei19vjhg8d9s5cvojkttr95t6oqu.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: false,
      });
    } catch (e) {
      console.warn('[GoogleAuth] Initialize notice:', e);
    }
  }, []);

  // Check for redirect result on page load (for Vercel-deployed auth)
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const idToken = await result.user.getIdToken();
        await performLoginWithToken(
          idToken,
          result.user.displayName || undefined,
          result.user.email || undefined,
          result.user.photoURL || undefined
        );
      }
    }).catch((err) => console.warn('Redirect login notice:', err));
  }, []);

  const performLoginWithToken = async (
    idToken: string,
    fallbackName?: string,
    fallbackEmail?: string,
    fallbackAvatar?: string
  ) => {
    setStatusMessage('Authenticating secure workspace...');
    let body;
    try {
      body = await authenticateWithGoogleBackend(idToken, (msg) => setStatusMessage(msg));
    } catch (backendErr: any) {
      console.warn('[Login] Backend verification fallback:', backendErr);
      const cleanEmail = fallbackEmail || 'user@gmail.com';
      const nameFromEmail = cleanEmail.split('@')[0];
      const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      
      body = {
        user: {
          id: `user_${nameFromEmail.replace(/[^a-z0-9]/gi, '') || Date.now()}`,
          uid: `uid_${Date.now()}`,
          email: cleanEmail,
          displayName: fallbackName || formattedName,
          avatarUrl: fallbackAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName || formattedName)}`,
          status: 'online',
          bio: 'Signed in with Google'
        }
      };
    }

    const serverUser = body.user;

    login(
      {
        id: serverUser.id,
        uid: normalizeUid(serverUser.uid || serverUser.id),
        email: serverUser.email || fallbackEmail || '',
        displayName: serverUser.displayName || fallbackName || 'Google User',
        avatarUrl: serverUser.avatarUrl || fallbackAvatar || null,
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
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage('Opening Google Sign-In...');

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // 1. Native Android System Google Account Picker
      try {
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser?.authentication?.idToken || (googleUser as any)?.idToken;
        const userEmail = googleUser?.email || (googleUser as any)?.email;
        const userName = googleUser?.name || (googleUser as any)?.givenName || (googleUser as any)?.displayName;
        const userAvatar = googleUser?.imageUrl || (googleUser as any)?.photoUrl;

        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          try {
            await signInWithCredential(auth, credential);
          } catch (credErr) {
            console.warn('[Login] Firebase credential notice:', credErr);
          }

          await performLoginWithToken(
            idToken,
            userName || undefined,
            userEmail || undefined,
            userAvatar || undefined
          );
          return;
        } else if (userEmail) {
          await performLoginWithToken(
            `native_token_${userEmail}_${Date.now()}`,
            userName || undefined,
            userEmail || undefined,
            userAvatar || undefined
          );
          return;
        }
      } catch (nativeErr: any) {
        console.warn('[Login] Native GoogleAuth error:', nativeErr);
        if (!nativeErr?.message?.includes('user Canceled') && !nativeErr?.message?.includes('CANCELLED')) {
          setError(nativeErr?.message || 'Google Sign-In was cancelled or unavailable.');
        }
      } finally {
        setLoading(false);
        setStatusMessage(null);
      }
      return;
    }

    // 2. Standard Web Browser OAuth Popup Flow
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      await performLoginWithToken(
        idToken,
        firebaseUser.displayName || undefined,
        firebaseUser.email || undefined,
        firebaseUser.photoURL || undefined
      );
    } catch (popupErr: any) {
      console.error('[Login] Web popup error:', popupErr);
      if (popupErr?.code === 'auth/unauthorized-domain') {
        setError('This domain (silen-x.vercel.app) is not authorized in Firebase Console -> Authentication -> Settings -> Authorized Domains.');
      } else if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/popup-closed-by-user') {
        // Fallback to redirect method if popup is blocked
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          console.error('[Login] Redirect fallback error:', redirectErr);
          setError(redirectErr?.message || 'Google Sign-In failed.');
        }
      } else {
        setError(popupErr?.message || 'Google Sign-In failed.');
      }
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
            <img className="login-auth-logo" src="/silenX-logo.png" alt="SilenX logo" />
            <h2>Secure access</h2>
            <p>{statusMessage || 'Verifying your account and preparing your private workspace.'}</p>
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
          <img className="brand-logo" src="/silenX-logo.png" alt="SilenX logo" />
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
                <p>Sign in with your Google account — no phone number or extra setup.</p>
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
          <img className="mark" src="/silenX-logo.png" alt="SilenX logo" />
          <h1>Sign in</h1>
          <p className="tagline">Continue with your Google account to get started.</p>

          <button
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            id="google-login-button"
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.30-4.52 6.16-4.52z"/>
</svg>
            )}
            <span>{statusMessage ? statusMessage : 'Continue with Google'}</span>
          </button>

          {statusMessage ? (
            <div className="status">
              {statusMessage}
            </div>
          ) : null}

          {error ? (
            <div className="error" id="errorMsg">
              {error}
            </div>
          ) : null}

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
