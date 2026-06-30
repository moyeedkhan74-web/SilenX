import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Lock, X } from 'lucide-react';
import UserPreviewModal from './UserPreviewModal';
import { useChatStore } from '../store/chatStore';
import './AddContactModal.css';

interface FoundUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  status: string;
  bio: string;
}

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddComplete: () => void;
}

/**
 * Parse UID from scanned QR data.
 * Accepts formats:
 *   - "slienx://uid/SEC_xxxxxxxxxxxx"
 *   - "SEC_xxxxxxxxxxxx" (raw UID)
 */
function parseUidFromScan(data: string): string | null {
  const deepLinkMatch = data.match(/slienx:\/\/uid\/(SEC_[0-9a-fA-F]+)/);
  if (deepLinkMatch) return deepLinkMatch[1];
  const rawMatch = data.match(/^(SEC_[0-9a-fA-F]{8,})$/);
  if (rawMatch) return rawMatch[1];
  return null;
}

/** Validate UID format: must be SEC_ followed by hex chars, total >= 16 chars */
function isValidUid(uid: string): boolean {
  return /^SEC_[0-9a-fA-F]{8,}$/.test(uid.trim());
}

const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onAddComplete }) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'enter'>('scan');
  const [uid, setUid] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState('');
  const [error, setError] = useState('');
  const [previewUser, setPreviewUser] = useState<FoundUser | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { createConversation, setActiveConversation } = useChatStore();

  // Clean up scanner when modal closes or tab switches
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setUid('');
      setPreviewUser(null);
      setScanError('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== 'scan') {
      stopScanner();
    }
    setError('');
  }, [activeTab]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
      setScannerActive(false);
    }
  };

  const startScanner = async () => {
    setScanError('');
    try {
      const html5Qrcode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const parsedUid = parseUidFromScan(decodedText);
          if (parsedUid) {
            setUid(parsedUid);
            stopScanner();
            lookupByUid(parsedUid);
          } else {
            setScanError('Invalid QR code. Expected a SlienX QR code.');
          }
        },
        () => { /* ignore scan failures (no QR in frame) */ }
      );

      setScannerActive(true);
    } catch (err: any) {
      console.error('Scanner start failed:', err);
      setScanError(
        err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera access.'
          : 'Could not start camera. Make sure no other app is using it.'
      );
    }
  };

  const lookupByUid = async (searchUid: string) => {
    setIsSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/users/by-uid/${encodeURIComponent(searchUid)}`);
      if (res.ok) {
        const user: FoundUser = await res.json();
        setPreviewUser(user);
      } else {
        setError(`Secure ID "${searchUid}" not found. Try: SEC_f6e5d4c3b2a1 (Bob) or SEC_a1b2c3d4e5f6 (Alice).`);
      }
    } catch (err) {
      console.error('Lookup failed:', err);
      setError('Network error during lookup.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLookup = () => {
    const formattedUid = uid.trim();
    if (!formattedUid) {
      setError('Please enter a Secure ID.');
      return;
    }
    if (!isValidUid(formattedUid)) {
      setError('Invalid format. UID must start with SEC_ followed by hex characters (e.g., SEC_a1b2c3d4e5f6).');
      return;
    }
    lookupByUid(formattedUid);
  };

  const handleAddContact = async () => {
    if (!previewUser) return;

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUid: previewUser.uid }),
      });
      if (res.ok) {
        // request created
        setPreviewUser(null);
        setUid('');
        onAddComplete();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.message || 'Failed to send request');
      }
    } catch (err) {
      console.error('Send request failed:', err);
      setError('Network error when sending request');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content add-contact-modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
          <h2>Add Contact</h2>
          
          <div className="modal-tabs">
            <button 
              className={`modal-tab ${activeTab === 'scan' ? 'active' : ''}`}
              onClick={() => setActiveTab('scan')}
            >
              <Camera size={16} /> Scan QR
            </button>
            <button 
              className={`modal-tab ${activeTab === 'enter' ? 'active' : ''}`}
              onClick={() => setActiveTab('enter')}
            >
              <Lock size={16} /> Enter UID
            </button>
          </div>

          <div className="modal-tab-content">
            {activeTab === 'scan' ? (
              <div className="scan-tab">
                <div id="qr-reader" className="qr-reader-container" />
                
                {scanError && (
                  <p className="scan-error">{scanError}</p>
                )}

                {!scannerActive && (
                  <div className="scan-start-area">
                    <p className="camera-subtext">Point your camera at a SlienX QR code</p>
                    <button 
                      className="btn btn-primary"
                      onClick={startScanner}
                    >
                      <Camera size={16} /> Open Camera
                    </button>
                  </div>
                )}

                {scannerActive && (
                  <div className="scan-controls">
                    <p style={{ color: 'var(--primary-light)', fontWeight: 600, fontSize: '0.85rem' }}>
                      Scanning for QR codes...
                    </p>
                    <button 
                      className="btn-secondary"
                      onClick={stopScanner}
                      style={{ marginTop: 8 }}
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="enter-tab">
                <p className="enter-help">Enter the 16-character Secure ID (starts with SEC_)</p>
                <input 
                  type="text" 
                  className="input-uid"
                  placeholder="SEC_xxxxxxxxxxxx" 
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  disabled={isSearching}
                  maxLength={20}
                />
                {error && (
                  <p className="scan-error" style={{ marginBottom: 16 }}>{error}</p>
                )}
                <button className="btn btn-primary btn-block" onClick={handleLookup} disabled={isSearching}>
                  {isSearching ? 'Searching...' : 'Lookup User'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewUser && (
        <UserPreviewModal 
          user={{
            name: previewUser.displayName,
            avatar: previewUser.displayName[0],
            status: previewUser.status.charAt(0).toUpperCase() + previewUser.status.slice(1),
          }}
          onClose={() => setPreviewUser(null)}
          onAdd={handleAddContact}
        />
      )}
    </>
  );
};

export default AddContactModal;
