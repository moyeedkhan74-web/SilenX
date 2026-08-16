import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

export interface ImageCropperModalProps {
  imageSrc: string;
  isOpen: boolean;
  aspectRatio?: '1:1' | 'free' | '16:9' | '4:3';
  onCropComplete: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  isOpen,
  aspectRatio = 'free',
  onCropComplete,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen, zoom, rotation]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    let targetWidth = 500;
    let targetHeight = 500;

    if (aspectRatio === '1:1') {
      targetWidth = 400;
      targetHeight = 400;
    } else if (aspectRatio === '16:9') {
      targetWidth = 533;
      targetHeight = 300;
    } else if (aspectRatio === '4:3') {
      targetWidth = 480;
      targetHeight = 360;
    } else {
      const scale = Math.min(500 / img.width, 500 / img.height, 1);
      targetWidth = Math.round(img.width * scale);
      targetHeight = Math.round(img.height * scale);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.save();

    // Center rotation & zoom
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    ctx.drawImage(
      img,
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight
    );

    ctx.restore();
  };

  const handleCropSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const croppedUrl = canvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
            {aspectRatio === '1:1' ? 'Crop Profile Avatar' : 'Edit & Crop Media'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Canvas Workspace */}
        <div
          style={{
            padding: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#09090b',
            minHeight: '320px',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              maxHeight: '360px',
              maxWidth: '100%',
              borderRadius: aspectRatio === '1:1' ? '50%' : '8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          />
        </div>

        {/* Controls */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: '#18181b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              title="Zoom out"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              title="Zoom in"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Rotate"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#ccc',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropSave}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--color-accent, #6366f1)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Check size={18} /> Save & Attach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;