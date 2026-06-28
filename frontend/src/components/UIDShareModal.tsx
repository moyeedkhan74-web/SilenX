import React, { useRef, useState } from 'react';
import { Copy, Download, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './UIDShareModal.css';

interface UIDShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
}

const UIDShareModal: React.FC<UIDShareModalProps> = ({ isOpen, onClose, uid }) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const deepLink = `slienx://uid/${uid}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPNG = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${uid}_qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    }, 'image/png');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content uid-share-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <h2>Your Secure ID</h2>
        
        <div className="qr-container" ref={qrRef}>
          <div className="qr-canvas-wrapper">
            <QRCodeCanvas
              value={deepLink}
              size={300}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#212121"
            />
          </div>
        </div>
        
        <p className="uid-display-text">{uid}</p>
        
        <div className="uid-actions">
          <button className="btn btn-primary" onClick={handleCopy} disabled={copied}>
            {copied ? 'Copied!' : <><Copy size={16} /> Copy UID</>}
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPNG} disabled={downloaded}>
            {downloaded ? 'Saved!' : <><Download size={16} /> Download QR</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UIDShareModal;
