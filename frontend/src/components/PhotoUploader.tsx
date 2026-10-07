/**
 * PhotoUploader - Complete photo upload flow
 * Integrates AttachmentSheet, PhotoPreview, and useMediaUpload hook
 */

import { useState, useEffect } from 'react';
import { Paperclip } from 'lucide-react';
import { AttachmentSheet } from './AttachmentSheet';
import { PhotoPreview } from './PhotoPreview';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { UploadResult, MediaFile } from '../config/mediaConfig';

export interface PhotoUploaderProps {
  onUploadComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  buttonLabel?: string;
  buttonIcon?: React.ReactNode;
}

export const PhotoUploader = ({
  onUploadComplete,
  onError,
  buttonLabel,
  buttonIcon,
}: PhotoUploaderProps) => {
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const {
    items,
    error: hookError,
    pickCamera,
    pickGallery,
    cancel,
    retry,
    clearError,
  } = useMediaUpload();

  useEffect(() => {
    if (hookError && onError) {
      onError(hookError);
    }
  }, [hookError, onError]);

  // Determine the most recent item (last in array) as the preview item
  const previewItem = items.length > 0 ? items[items.length - 1] : null;

  const handlePickCamera = async () => {
    clearError();
    await pickCamera();
    setShowPreview(true);
  };

  const handlePickGallery = async () => {
    clearError();
    await pickGallery();
    setShowPreview(true);
  };

  const handleCloseSheet = () => {
    setShowAttachmentSheet(false);
  };

  const handleCancel = () => {
    if (previewItem) {
      cancel(previewItem.id);
    }
  };

  const handleRetry = () => {
    if (previewItem) {
      retry(previewItem.id);
    }
  };

  const handleRemove = () => {
    if (previewItem) {
      cancel(previewItem.id);
    }
    setShowPreview(false);
  };

  const handleSend = () => {
    if (previewItem && previewItem.status === 'done' && onUploadComplete) {
      onUploadComplete({
        id: previewItem.id,
        storagePath: previewItem.storagePath,
        downloadUrl: (previewItem as any).downloadUrl || '',
        size: previewItem.file.size,
        mimeType: previewItem.file.type,
      });
    }
    setShowPreview(false);
  };

  const getMediaFileStatus = (status: string): MediaFile['status'] => {
    switch (status) {
      case 'uploading':
        return 'uploading';
      case 'done':
        return 'done';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  };

  const mediaFile: MediaFile | null = previewItem
    ? {
        id: previewItem.id,
        name: previewItem.file.name,
        path: URL.createObjectURL(previewItem.file),
        size: previewItem.file.size,
        mimeType: previewItem.file.type,
        status: getMediaFileStatus(previewItem.status),
        progress: previewItem.progress,
      }
    : null;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShowAttachmentSheet(true)}
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
          color: '#8696a0',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#00a884';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#8696a0';
        }}
        aria-label={buttonLabel || 'Attach photo'}
      >
        {buttonIcon || <Paperclip size={22} />}
      </button>

      {/* Attachment Sheet */}
      <AttachmentSheet
        isOpen={showAttachmentSheet}
        onClose={handleCloseSheet}
        onPickCamera={handlePickCamera}
        onPickGallery={handlePickGallery}
        onPickDocument={() => {}}
      />

      {/* Photo Preview */}
      {showPreview && mediaFile && previewItem && (
        <PhotoPreview
          file={mediaFile}
          progress={previewItem.progress}
          status={mediaFile.status}
          error={previewItem.error}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onSend={handleSend}
          onRemove={handleRemove}
        />
      )}
    </>
  );
};
