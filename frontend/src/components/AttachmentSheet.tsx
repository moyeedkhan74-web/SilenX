/**
 * AttachmentSheet - Bottom sheet for choosing photo source
 * Provides Camera, Gallery, and Document options (Step 1: Camera & Gallery only)
 */

import { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera as CameraIcon, Image as ImageIcon, FileText } from 'lucide-react';
import { validateFile } from '../utils/mediaValidation';

export interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
  onError?: (error: string) => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

const ActionButton = ({ icon, label, description, onClick }: ActionButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        padding: '16px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        gap: '16px',
        borderRadius: '12px',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00a884 0%, #008f72 100%)',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ color: '#e9edef', fontSize: '15px', fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ color: '#8696a0', fontSize: '13px', marginTop: '2px' }}>
          {description}
        </div>
      </div>
    </button>
  );
};

export const AttachmentSheet = ({
  isOpen,
  onClose,
  onFileSelected,
  onError,
}: AttachmentSheetProps) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle camera capture
   */
  const handleCamera = async () => {
    try {
      setLoading(true);
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (image.webPath) {
        // Convert webPath to File
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const fileName = `photo_${Date.now()}.${image.format || 'jpg'}`;
        const file = new File([blob], fileName, { type: `image/${image.format || 'jpeg'}` });

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          onError?.(validation.error || 'Invalid file');
          return;
        }

        onFileSelected(file);
        onClose();
      }
    } catch (error) {
      console.error('Camera error:', error);
      // User cancelled or permission denied - no error message needed
      if ((error as Error).message && !((error as Error).message.includes('User cancelled'))) {
        onError?.((error as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle gallery selection
   * Uses Capacitor Camera with Photos source for Android Photo Picker
   */
  const handleGallery = async () => {
    try {
      setLoading(true);
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });

      if (image.webPath) {
        // Convert webPath to File
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const fileName = `photo_${Date.now()}.${image.format || 'jpg'}`;
        const file = new File([blob], fileName, { type: `image/${image.format || 'jpeg'}` });

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          onError?.(validation.error || 'Invalid file');
          return;
        }

        onFileSelected(file);
        onClose();
      }
    } catch (error) {
      console.error('Gallery error:', error);
      if ((error as Error).message && !((error as Error).message.includes('User cancelled'))) {
        onError?.((error as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle HTML file input for web fallback
   */
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      onError?.(validation.error || 'Invalid file');
      return;
    }

    onFileSelected(file);
    onClose();

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Bottom Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#1f2c34',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          padding: '20px 16px',
          zIndex: 1000,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              background: '#374045',
              borderRadius: '2px',
            }}
          />
        </div>

        {/* Title */}
        <h3
          style={{
            color: '#e9edef',
            fontSize: '16px',
            fontWeight: 600,
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}
        >
          Send Photo
        </h3>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <ActionButton
            icon={<CameraIcon size={22} />}
            label="Camera"
            description="Take a new photo"
            onClick={handleCamera}
          />

          <ActionButton
            icon={<ImageIcon size={22} />}
            label="Gallery"
            description="Choose from your photos"
            onClick={handleGallery}
          />

          <ActionButton
            icon={<FileText size={22} />}
            label="Document"
            description="Coming soon"
            onClick={() => {
              onError?.('Document picker coming in next step');
            }}
          />
        </div>

        {/* Cancel button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            marginTop: '16px',
            background: '#374045',
            border: 'none',
            borderRadius: '24px',
            color: '#e9edef',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        {/* Hidden file input for web fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(31, 44, 52, 0.8)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
            }}
          >
            <div
              style={{
                color: '#e9edef',
                fontSize: '14px',
              }}
            >
              Loading...
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};
