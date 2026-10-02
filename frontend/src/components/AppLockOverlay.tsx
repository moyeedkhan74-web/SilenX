import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import './AppLockOverlay.css';

type PinStep = 'setup' | 'confirm' | 'unlock' | 'locked';

export const AppLockOverlay: React.FC = () => {
  const appLockEnabled = useSettingsStore((s) => s.appLockEnabled);
  const appLockPin = useSettingsStore((s) => s.appLockPin);
  const appLockTimeoutMinutes = useSettingsStore((s) => s.appLockTimeoutMinutes);
  const setAppLockEnabled = useSettingsStore((s) => s.setAppLockEnabled);
  const setAppLockPin = useSettingsStore((s) => s.setAppLockPin);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [step, setStep] = useState<PinStep>('unlock');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isLocked, setIsLocked] = useState(false);
  const timerRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    if (isLocked) {
      setIsLocked(false);
      setStep('unlock');
      setPin('');
      setError(null);
    }
  }, [isLocked]);

  useEffect(() => {
    if (!appLockEnabled || !appLockPin) return;

    const activityEvents: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handlers: (() => void)[] = [];

    activityEvents.forEach((eventName) => {
      const handler = () => resetTimer();
      window.addEventListener(eventName, handler);
      handlers.push(handler);
    });

    return () => {
      handlers.forEach((handler, index) => {
        window.removeEventListener(activityEvents[index], handler);
      });
    };
  }, [appLockEnabled, appLockPin, resetTimer]);

  useEffect(() => {
    if (!appLockEnabled || !appLockPin) return;
    if (isLocked) return;

    const timeoutMs = appLockTimeoutMinutes * 60 * 1000;

    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= timeoutMs) {
        setIsLocked(true);
        setStep('locked');
        setPin('');
        setError(null);
      }
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [appLockEnabled, appLockPin, appLockTimeoutMinutes, lastActivity, isLocked]);

  useEffect(() => {
    if (!appLockEnabled) {
      setIsLocked(false);
      setStep('unlock');
      setPin('');
      setError(null);
    }
  }, [appLockEnabled]);

  const handleBlur = useCallback(() => {
    if (appLockEnabled && appLockPin && !isLocked) {
      setIsLocked(true);
      setStep('locked');
      setPin('');
      setError(null);
    }
  }, [appLockEnabled, appLockPin, isLocked]);

  useEffect(() => {
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [handleBlur]);

  const handlePinInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError(null);

    if (step === 'unlock' && digits.length === 4) {
      if (digits === appLockPin) {
        setIsLocked(false);
        setStep('unlock');
        setPin('');
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    }

    if (step === 'setup' && digits.length === 4) {
      setConfirmPin('');
      setStep('confirm');
    }
  };

  const handleConfirmInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setConfirmPin(digits);
    setError(null);

    if (digits.length === 4) {
      if (digits === pin) {
        setAppLockPin(digits);
        setAppLockEnabled(true);
        setStep('unlock');
        setPin('');
        setConfirmPin('');
      } else {
        setError('PINs do not match');
        setConfirmPin('');
        setStep('setup');
      }
    }
  };

  const handleDisable = () => {
    setAppLockEnabled(false);
    setAppLockPin(null);
    setIsLocked(false);
    setStep('unlock');
    setPin('');
    setError(null);
  };

  const handleDelete = () => {
    if (step === 'locked' || step === 'unlock') {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === 'setup') {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
    setError(null);
  };

  const handleBiometric = async () => {
    setError('Biometric authentication is not available in this browser');
  };

  if (!isAuthenticated) return null;

  if (appLockEnabled && isLocked) {
    return (
      <div className="app-lock-overlay">
        <div className="app-lock-card">
          <div className="app-lock-icon">
            <Lock size={32} />
          </div>
          <h2 className="app-lock-title">App Locked</h2>
          <p className="app-lock-subtitle">Enter your PIN to unlock</p>

          {error && (
            <div className="app-lock-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="app-lock-pin-container">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`app-lock-pin-dot ${pin.length > index ? 'filled' : ''}`}
              >
                {pin.length > index && showPin ? pin[index] : ''}
              </div>
            ))}
          </div>

          <div className="app-lock-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'bio', 0, 'del'].map((key) => (
              <button
                key={key}
                type="button"
                className={`app-lock-key ${key === 'bio' ? 'app-lock-key-bio' : ''} ${key === 'del' ? 'app-lock-key-del' : ''}`}
                onClick={() => {
                  if (key === 'del') {
                    handleDelete();
                  } else if (key === 'bio') {
                    void handleBiometric();
                  } else {
                    handlePinInput(pin + String(key));
                  }
                }}
              >
                {key === 'bio' ? <Eye size={20} /> : key === 'del' ? <EyeOff size={20} /> : key}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="app-lock-toggle-visibility"
            onClick={() => setShowPin((v) => !v)}
          >
            {showPin ? 'Hide PIN' : 'Show PIN'}
          </button>
        </div>
      </div>
    );
  }

  if (!appLockEnabled && (step === 'setup' || step === 'confirm')) {
    return (
      <div className="app-lock-overlay">
        <div className="app-lock-card">
          <div className="app-lock-icon">
            <Lock size={32} />
          </div>
          <h2 className="app-lock-title">Create App Lock PIN</h2>
          <p className="app-lock-subtitle">
            {step === 'setup' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
          </p>

          {error && (
            <div className="app-lock-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="app-lock-pin-container">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`app-lock-pin-dot ${(step === 'setup' ? pin : confirmPin).length > index ? 'filled' : ''}`}
              >
                {(step === 'setup' ? pin : confirmPin).length > index && showPin
                  ? (step === 'setup' ? pin : confirmPin)[index]
                  : ''}
              </div>
            ))}
          </div>

          <div className="app-lock-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, idx) => (
              <button
                key={idx}
                type="button"
                className={`app-lock-key ${key === null ? 'app-lock-key-empty' : ''} ${key === 'del' ? 'app-lock-key-del' : ''}`}
                onClick={() => {
                  if (key === 'del') {
                    handleDelete();
                  } else if (key !== null) {
                    if (step === 'setup') {
                      handlePinInput(pin + String(key));
                    } else {
                      handleConfirmInput(confirmPin + String(key));
                    }
                  }
                }}
              >
                {key === 'del' ? <EyeOff size={20} /> : key ?? ''}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="app-lock-toggle-visibility"
            onClick={() => setShowPin((v) => !v)}
          >
            {showPin ? 'Hide PIN' : 'Show PIN'}
          </button>

          <button
            type="button"
            className="app-lock-cancel"
            onClick={() => {
              setStep('unlock');
              setPin('');
              setConfirmPin('');
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (appLockEnabled && !isLocked) {
    return (
      <div className="app-lock-overlay">
        <div className="app-lock-card">
          <div className="app-lock-icon">
            <Lock size={32} />
          </div>
          <h2 className="app-lock-title">Unlock App</h2>
          <p className="app-lock-subtitle">Enter your PIN or use biometrics</p>

          {error && (
            <div className="app-lock-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="app-lock-pin-container">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`app-lock-pin-dot ${pin.length > index ? 'filled' : ''}`}
              >
                {pin.length > index && showPin ? pin[index] : ''}
              </div>
            ))}
          </div>

          <div className="app-lock-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'bio', 0, 'del'].map((key) => (
              <button
                key={key}
                type="button"
                className={`app-lock-key ${key === 'bio' ? 'app-lock-key-bio' : ''} ${key === 'del' ? 'app-lock-key-del' : ''}`}
                onClick={() => {
                  if (key === 'del') {
                    handleDelete();
                  } else if (key === 'bio') {
                    void handleBiometric();
                  } else {
                    handlePinInput(pin + String(key));
                  }
                }}
              >
                {key === 'bio' ? <Eye size={20} /> : key === 'del' ? <EyeOff size={20} /> : key}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="app-lock-toggle-visibility"
            onClick={() => setShowPin((v) => !v)}
          >
            {showPin ? 'Hide PIN' : 'Show PIN'}
          </button>

          <button
            type="button"
            className="app-lock-cancel"
            onClick={handleDisable}
          >
            Disable App Lock
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AppLockOverlay;
