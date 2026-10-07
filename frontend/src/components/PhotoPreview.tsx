/**
 * PhotoPreview - Preview selected photo before sending
 * Shows thumbnail, file info, and upload progress
 */

import { useState, useEffect } from 'react';
import { X, Send, RefreshCw } from 'lucide-react';
import { formatFileSize } from '../utils/mediaValidation';
import { MediaFile } from '../config/mediaConfig';

export interface PhotoPreviewProps {
  file: MediaFile;
  thumbnailDataUrl?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'failed' | 'cancelled';
  error?: string;
  onCancel: () => void;
  onRetry: () => void;
  onSend: () => void;
  onRemove: () => void;
  autoSend?: boolean;
}

export const PhotoPreview = ({
  file,
  thumbnailDataUrl,
  progress,
  status,
  error,
  onCancel,
  onRetry,
  onSend,
  onRemove,
}: PhotoPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(thumbnailDataUrl || null);
  const [showFullImage, setShowFullImage] = useState(false);

  /**
   * Generate thumbnail if not provided
   */
  useEffect(() => {
    if (!previewUrl && file.path) {
      generateImagePreview(file.path);
    }
  }, [file.path]);

  /**
   * Generate preview from file path or URL
   */
  const generateImagePreview = async (path: string) => {
    try {
      // If it's already a data URL, use it directly
      if (path.startsWith('data:')) {
        setPreviewUrl(path);
        return;
      }

      // Otherwise, fetch and convert
      const response = await fetch(path);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Preview generation failed:', err);
    }
  };

  /**
   * Get status text
   */
  const getStatusText = (): string => {
    switch (status) {
      case 'pending':
        return 'Ready to send';
      case 'uploading':
        return `Uploading... ${progress}%`;
      case 'done':
        return 'Sent';
      case 'failed':
        return error || 'Upload failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (): string => {
    switch (status) {
      case 'done':
        return '#00a884';
      case 'failed':
        return '#f15c6d';
      case 'uploading':
        return '#8696a0';
      default:
        return '#8696a0';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#0b141a',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          background: '#1f2c34',
          borderBottom: '1px solid #374045',
        }}
      >
        <button
          type="button"
          onClick={onRemove}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            background: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            color: '#e9edef',
          }}
          aria-label="Remove"
        >
          <X size={22} />
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: '#e9edef', fontSize: '16px', fontWeight: 600 }}>
            Photo Preview
          </div>
          <div style={{ color: '#8696a0', fontSize: '12px', marginTop: '2px' }}>
            {formatFileSize(file.size)} • {file.mimeType}
          </div>
        </div>

        <div style={{ width: '40px' }} />
      </div>

      {/* Image Preview */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b141a',
          padding: '16px',
          overflow: 'hidden',
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              cursor: showFullImage ? 'zoom-out' : 'zoom-in',
            }}
            onClick={() => setShowFullImage(!showFullImage)}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '200px',
              height: '200px',
              background: '#1f2c34',
              borderRadius: '8px',
              color: '#8696a0',
            }}
          >
            Loading...
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {status === 'uploading' && (
        <div style={{ padding: '0 16px', marginBottom: '8px' }}>
          <div
            style={{
              width: '100%',
              height: '4px',
              background: '#374045',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00a884 0%, #008f72 100%)',
                transition: 'width 0.2s ease-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Status */}
      <div
        style={{
          padding: '8px 16px',
          textAlign: 'center',
          color: getStatusColor(),
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        {getStatusText()}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '16px',
          background: '#1f2c34',
          borderTop: '1px solid #374045',
        }}
      >
        {status === 'uploading' && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '14px',
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
        )}

        {status === 'failed' && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              flex: 1,
              padding: '14px',
              background: '#374045',
              border: 'none',
              borderRadius: '24px',
              color: '#e9edef',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={18} />
            Retry
          </button>
        )}

        {(status === 'pending' || status === 'done') && (
          <button
            type="button"
            onClick={onSend}
            disabled={status === 'done'}
            style={{
              flex: 1,
              padding: '14px',
              background: status === 'done' ? '#374045' : 'linear-gradient(135deg, #00a884 0%, #008f72 100%)',
              border: 'none',
              borderRadius: '24px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: status === 'done' ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Send size={18} />
            {status === 'done' ? 'Sent' : 'Send'}
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
