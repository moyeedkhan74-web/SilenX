import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCw, ZoomIn, ZoomOut, Move } from 'lucide-react';

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
  aspectRatio = '1:1',
  onCropComplete,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset state when modal opens or image change
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetWidth = 400;
    let targetHeight = 400;

    if (aspectRatio === '16:9') {
      targetWidth = 533;
      targetHeight = 300;
    } else if (aspectRatio === '4:3') {
      targetWidth = 480;
      targetHeight = 360;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.save();

    // Center point for zoom, pan & rotate
    ctx.translate(targetWidth / 2 + offset.x, targetHeight / 2 + offset.y);
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
  }, [aspectRatio, offset, rotation, zoom]);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen, drawCanvas]);

  // Handle Drag / Pan
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX - offset.x, y: clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: clientX - dragStart.current.x,
      y: clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
        backdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#111b21',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Move size={18} color="var(--color-accent, #00a884)" />
            <h3 style={{ margin: 0, color: '#e9edef', fontSize: '17px', fontWeight: 600 }}>
              Arrange Profile Picture
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#8696a0',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Interactive Canvas Workspace */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0b141a',
            position: 'relative',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '280px',
              height: '280px',
              borderRadius: aspectRatio === '1:1' ? '50%' : '12px',
              overflow: 'hidden',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 168, 132, 0.4)',
              border: '2px solid var(--color-accent, #00a884)',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#8696a0' }}>
            Drag image to center • Pinch / slider to zoom
          </p>
        </div>

        {/* Adjustments Bar */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: '#111b21',
          }}
        >
          {/* Zoom Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ZoomOut size={16} color="#8696a0" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--color-accent, #00a884)',
                cursor: 'pointer',
              }}
            />
            <ZoomIn size={16} color="#8696a0" />
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Rotate 90°"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#e9edef',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '8px',
              }}
            >
              <RotateCw size={16} />
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#8696a0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropSave}
              style={{
                padding: '10px 24px',
                borderRadius: '24px',
                border: 'none',
                background: 'var(--color-accent, #00a884)',
                color: '#111b21',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0, 168, 132, 0.3)',
              }}
            >
              <Check size={18} /> Apply Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;