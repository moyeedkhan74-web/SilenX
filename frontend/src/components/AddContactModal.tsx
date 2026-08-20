import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Lock, CheckCircle2 } from 'lucide-react';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import UserPreviewModal from './UserPreviewModal';
import { API_URL, normalizeUid } from '../config/webrtc-config';
import { useAuthStore } from '../store/authStore';
import './AddContactModal.css';

interface FoundUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  status?: string;
  bio: string;
}

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddComplete: () => void;
}

function parseUidFromScan(data: string): string | null {
  const deepLinkMatch = data.match(/slienx:\/\/uid\/(.+)/i);
  if (deepLinkMatch) return deepLinkMatch[1].trim();

  const rawMatch = data.match(/^(SEC_[A-Za-z0-9._-]+|[A-Za-z0-9._-]+)$/i);
  if (rawMatch) return rawMatch[1].trim();

  return null;
}

function isValidUid(uid: string): boolean {
  const normalized = normalizeUid(uid);
  return /^SEC_[A-Za-z0-9._-]{3,}$/.test(normalized);
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onAddComplete }) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'enter'>('scan');
  const [uid, setUid] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [error, setError] = useState('');
  const [previewUser, setPreviewUser] = useState<FoundUser | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setScanSuccess(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== 'scan') {
      stopScanner();
    }
    setError('');
    setScanSuccess(false);
  }, [activeTab]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
      setScannerActive(false);
    }
  };

  const scanImageFromFile = async (file: File) => {
    setScanError('');
    setScanSuccess(false);
    try {
      await stopScanner();
      const html5Qrcode = scannerRef.current ?? new Html5Qrcode('qr-reader');
      scannerRef.current = html5Qrcode;
      const decodedText = await (html5Qrcode as any).scanFile(file, true);
      const parsedUid = parseUidFromScan(decodedText);
      if (parsedUid) {
        setScanSuccess(true);
        setUid(parsedUid);
        lookupByUid(parsedUid);
      } else {
        setScanError('Invalid QR code. Expected a SlienX QR code.');
      }
    } catch (err: any) {
      console.error('Image scan failed:', err);
      setScanError('Could not decode a QR code from this image. Try a clearer photo or a different image.');
    }
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await scanImageFromFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startScanner = async () => {
    setScanError('');
    setScanSuccess(false);
    try {
      const html5Qrcode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const parsedUid = parseUidFromScan(decodedText);
          if (parsedUid) {
            setScanSuccess(true);
            setUid(parsedUid);
            stopScanner();
            lookupByUid(parsedUid);
          } else {
            setScanError('Invalid QR code. Expected a SlienX QR code.');
          }
        },
        () => {}
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
      const token = useAuthStore.getState().token;
      if (!token) {
        setError('Authentication token missing. Please sign in again.');
        setIsSearching(false);
        return;
      }
      const res = await fetch(`${API_URL}/api/users/search?uid=${encodeURIComponent(searchUid)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const user: FoundUser = await res.json();
        setPreviewUser(user);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.message || 'No account found for this Secure ID. Please check the ID and try again.');
        setScanSuccess(false);
      }
    } catch (err) {
      console.error('Lookup failed:', err);
      setError('Network error during lookup.');
      setScanSuccess(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLookup = () => {
    const formattedUid = normalizeUid(uid);
    if (!formattedUid) {
      setError('Please enter a Secure ID.');
      return;
    }
    if (!isValidUid(formattedUid)) {
      setError('Invalid format. Please enter a valid Secure ID.');
      return;
    }
    lookupByUid(formattedUid);
  };

  const handleAddContact = async () => {
    if (!previewUser) return;

    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        setError('Authentication token missing. Please sign in again.');
        return;
      }
      const res = await fetch(`${API_URL}/api/requests/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId: previewUser.id }),
      });
      if (res.ok) {
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

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} className="add-contact-modal" title="Add Contact">
        <div className="modal-tabs">
          <button 
            type="button"
            className={`modal-tab ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            <Camera size={16} /> Scan QR
          </button>
          <button 
            type="button"
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

              <div className="scan-actions-row">
                <div className="scan-action-card">
                  {scannerActive ? (
                    <>
                      <p className="camera-subtext">Scanning for QR codes...</p>
                      <Button variant="secondary" onClick={stopScanner} style={{ marginTop: 8 }}>
                        Stop Camera
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="camera-subtext">Point your camera at a SlienX QR code</p>
                      <Button variant="primary" onClick={startScanner}>
                        <Camera size={16} /> Open Camera
                      </Button>
                    </>
                  )}
                </div>

                <div className="scan-action-card">
                  <p className="camera-subtext">Or select an image from your gallery</p>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={16} /> Upload from gallery
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileSelection}
                  />
                </div>
              </div>

              {scanSuccess && (
                <div className="scan-success-banner">
                  <CheckCircle2 size={20} />
                  <span>QR code captured successfully!</span>
                </div>
              )}
              
              {/* Lookup feedback for scan tab */}
              {scanSuccess && isSearching && (
                <div className="scan-lookup-indicator">
                  <div className="scan-loading-spinner" />
                  <span>Looking up user...</span>
                </div>
              )}
              
              {error && (
                <div style={{ textAlign: 'center' }}>
                  <p className="scan-error">{error}</p>
                  {uid && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginTop: 8, fontSize: 13, padding: '8px 16px' }}
                      onClick={() => { setError(''); setScanSuccess(true); lookupByUid(uid); }}
                    >
                      🔄 Retry Lookup
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="enter-tab">
              <p className="enter-help">Enter the Secure ID. If you paste a plain ID, it will be fixed automatically.</p>
              <Input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                disabled={isSearching}
                maxLength={64}
                placeholder="SEC_xxxxxxxxxxxx"
                error={error}
              />
              <Button variant="primary" fullWidth onClick={handleLookup} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Lookup User'}
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {previewUser && (
        <UserPreviewModal 
          user={{
            name: previewUser.displayName?.trim() || previewUser.uid || 'Unknown user',
            avatar: previewUser.displayName?.trim()?.charAt(0) || previewUser.uid?.charAt(0) || '?',
            status: (previewUser.status?.trim() || 'offline').charAt(0).toUpperCase() + (previewUser.status?.trim() || 'offline').slice(1),
          }}
          onClose={() => setPreviewUser(null)}
          onAdd={handleAddContact}
        />
      )}
    </>
  );
};

export default AddContactModal;
