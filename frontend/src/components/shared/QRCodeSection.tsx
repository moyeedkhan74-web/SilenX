import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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

  const qrBgColor = '#ffffff';
  const qrFgColor = '#0f172a';

  const handleDownload = async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const fileName = `silenx_qr_${uid}.png`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2500);
      } catch (err) {
        console.error('QR save error:', err);
        alert('Could not save QR code. Please check storage permissions.');
      }
    } else {
      // Web fallback
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    }
  };

  return (
    <div className="qrcode-section" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
    }}>
      <div ref={qrRef} className="qr-canvas-wrapper" style={{
        padding: '16px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        display: 'inline-block',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
      }}>
        <QRCodeCanvas
          value={deepLink}
          size={size}
          level="H"
          includeMargin={true}
          bgColor={qrBgColor}
          fgColor={qrFgColor}
          imageSettings={{
            src: '/silenX-logo.png',
            x: undefined,
            y: undefined,
            height: Math.round(size * 0.22),
            width: Math.round(size * 0.22),
            excavate: true,
          }}
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
        {downloaded ? '✓ Saved to Documents!' : 'Save QR Code'}
      </button>
    </div>
  );
};

export default QRCodeSection;