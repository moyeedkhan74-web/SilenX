import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { connectSocket } from '../services/socket';
import { API_URL, normalizeUid } from '../config/webrtc-config';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      setError('Google sign-in is not configured yet. Add your Firebase environment values.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const token = await firebaseUser.getIdToken();

      // Call backend to create/find server-side user and receive server token
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

          // register socket for server-side user id
          try {
            const socket = connectSocket();
            socket.emit('register', { userId: serverUser.id });
          } catch (err) {
            console.warn('Socket registration failed', err);
          }
        } else {
          console.warn('Backend auth failed, falling back to local user');
          login(
            {
              id: firebaseUser.uid,
              uid: firebaseUser.uid ? normalizeUid(firebaseUser.uid) : '',
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
      } catch (err) {
        console.error('Backend auth error', err);
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

      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-particles">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-glow" />
          <div className="login-badge">SX</div>
        </div>

        <div className="login-pill">
          <Sparkles size={14} />
          <span>Google-only secure sign in</span>
        </div>

        <h1 className="login-title">SlienX</h1>
        <p className="login-tagline">Private messaging, crystal-clear calls, and end-to-end protection.</p>

        <div className="login-features">
          <div className="login-feature">
            <span className="login-feature-icon"><Lock size={18} /></span>
            <span className="login-feature-label">Encrypted</span>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon"><ShieldCheck size={18} /></span>
            <span className="login-feature-label">No phone number</span>
          </div>
          <div className="login-feature">
            <span className="login-feature-icon"><ShieldCheck size={18} /></span>
            <span className="login-feature-label">Zero-knowledge</span>
          </div>
        </div>

        <button className="google-login-btn" onClick={handleGoogleLogin} disabled={loading} id="google-login-button">
          {loading ? (
            <span className="login-spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>{loading ? 'Signing you in…' : 'Continue with Google'}</span>
        </button>

        {error ? <p className="login-error">{error}</p> : null}

        <div className="login-footer">
          <span>Fast and private</span>
          <span className="login-footer-dot" />
          <span>Secure by design</span>
          <span className="login-footer-dot" />
          <span>Google-auth only</span>
        </div>

        <div className="login-trust-badges">
          <div className="trust-badge">
            <span className="trust-badge-icon"><ShieldCheck size={14} /></span>
            <span>X25519 Keys</span>
          </div>
          <div className="trust-badge">
            <span className="trust-badge-icon"><ShieldCheck size={14} /></span>
            <span>ChaCha20</span>
          </div>
          <div className="trust-badge">
            <span className="trust-badge-icon"><ShieldCheck size={14} /></span>
            <span>WebRTC</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
