import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface QRCodeSectionProps {
  uid: string;
  size?: number;
}

export const QRCodeSection: React.FC<QRCodeSectionProps> = ({ 
  uid,
  size = 200 
}) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const [downloaded, setDownloaded] = useState(false);

  const deepLink = `slienx://uid/${uid}`;

  const getCssVar = (name: string, fallback = '') => {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  };

  const qrBgColor = getCssVar('--color-surface');
  const qrFgColor = getCssVar('--text-primary');

  const handleDownload = () => {
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
    <div className="qrcode-section" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }}>
      <div ref={qrRef} className="qr-canvas-wrapper" style={{
        padding: '12px',
        backgroundColor: qrBgColor,
        borderRadius: '8px',
        display: 'inline-block'
      }}>
        <QRCodeCanvas
          value={deepLink}
          size={size}
          level="H"
          includeMargin={true}
          bgColor={qrBgColor}
          fgColor={qrFgColor}
        />
      </div>

      <button 
        type="button" 
        className="btn-secondary" 
        onClick={handleDownload}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          fontSize: '13px'
        }}
      >
        <Download size={14} /> 
        {downloaded ? 'Saved!' : 'Download QR Code'}
      </button>
    </div>
  );
};

export default QRCodeSection;
