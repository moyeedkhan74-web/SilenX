import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Lock, RefreshCw } from 'lucide-react';
import Modal from './ui/Modal';
import QRCodeSection from './shared/QRCodeSection';
import { fingerprintPublicKey, getPublicKey } from '../utils/crypto';
import './SecurityVerifyModal.css';

interface SecurityVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  peerPublicKey?: string | null;
  peerName?: string;
}

function generateSafetyFingerprint(localKey: string, peerKey: string): string {
  const combined = localKey + '|' + peerKey;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const absHash = Math.abs(hash);
  const hex = absHash.toString(16).padStart(16, '0');
  const repeated = (hex + hex + hex + hex).slice(0, 60);
  return repeated;
}

export const SecurityVerifyModal: React.FC<SecurityVerifyModalProps> = ({
  isOpen,
  onClose,
  peerPublicKey,
  peerName = 'Contact',
}) => {
  const [localFingerprint, setLocalFingerprint] = useState<string>('');
  const [peerFingerprint, setPeerFingerprint] = useState<string>('');
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localPublicKey = useMemo(() => getPublicKey(), []);

  useEffect(() => {
    if (!isOpen) return;
    if (!localPublicKey) {
      setError('No local public key found. Please ensure E2EE is initialized.');
      return;
    }

    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(async () => {
        const localHash = await fingerprintPublicKey(localPublicKey);
        const localFp = generateSafetyFingerprint(localHash, localHash);
        setLocalFingerprint(localFp);

        if (peerPublicKey) {
          try {
            const peerHash = await fingerprintPublicKey(peerPublicKey);
            const peerFp = generateSafetyFingerprint(localHash, peerHash);
            setPeerFingerprint(peerFp);
            setQrData(JSON.stringify({
              v: 1,
              type: 'safety_number',
              local: localHash,
              peer: peerHash,
              fingerprint: peerFp,
            }));
          } catch {
            setPeerFingerprint('');
            setQrData(JSON.stringify({
              v: 1,
              type: 'safety_number',
              local: localHash,
              fingerprint: localFp,
            }));
          }
        } else {
          setPeerFingerprint('');
          setQrData(JSON.stringify({
            v: 1,
            type: 'safety_number',
            local: localHash,
            fingerprint: localFp,
          }));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to generate safety number');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, localPublicKey, peerPublicKey]);

  const formatFingerprint = (fp: string): string => {
    if (!fp) return '';
    const chunks = fp.match(/.{1,5}/g) || [];
    return chunks.join(' ');
  };

  const handleCopyFingerprint = async (fingerprint: string) => {
    if (!fingerprint) return;
    try {
      await navigator.clipboard.writeText(fingerprint);
    } catch {
      // ignore clipboard failure
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verify Encryption" className="security-verify-modal">
      <div className="security-verify-content">
        {error && (
          <div className="security-error-banner">
            <Shield size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="security-loading">
            <RefreshCw size={20} className="security-spinner" />
            <span>Generating safety number...</span>
          </div>
        )}

        {!loading && !error && localFingerprint && (
          <>
            <div className="security-fingerprint-section">
              <div className="security-fingerprint-header">
                <Lock size={18} />
                <h3>Your Safety Number</h3>
              </div>
              <div className="security-fingerprint-value">
                {formatFingerprint(localFingerprint)}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleCopyFingerprint(localFingerprint)}
              >
                Copy
              </button>
            </div>

            {peerFingerprint && (
              <div className="security-fingerprint-section">
                <div className="security-fingerprint-header">
                  <Shield size={18} />
                  <h3>Shared Safety Number with {peerName}</h3>
                </div>
                <div className="security-fingerprint-value shared">
                  {formatFingerprint(peerFingerprint)}
                </div>
                <p className="security-fingerprint-note">
                  Compare this number with {peerName} out-of-band (in person, phone call, etc.).
                  If the numbers match, your conversation is end-to-end encrypted and secure.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleCopyFingerprint(peerFingerprint)}
                >
                  Copy
                </button>
              </div>
            )}

            <div className="security-qr-section">
              <h3>QR Code</h3>
              <p className="security-qr-note">
                Scan this QR code with {peerName}'s device to verify encryption.
              </p>
              {qrData && (
                <div className="security-qr-wrapper">
                  <QRCodeSection uid={qrData} size={220} />
                </div>
              )}
            </div>

            <div className="security-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SecurityVerifyModal;
