/**
 * PhotoUploader - Complete photo upload flow
 * Integrates AttachmentSheet, PhotoPreview, and useMediaUpload hook
 */

import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { AttachmentSheet } from './AttachmentSheet';
import { PhotoPreview } from './PhotoPreview';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { UploadResult } from '../config/mediaConfig';

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
    state,
    selectFile,
    startUpload,
    cancelUpload,
    retryUpload,
    reset,
  } = useMediaUpload({
    autoUpload: false,
  });

  /**
   * Handle file selection from attachment sheet
   */
  const handleFileSelected = async (file: File) => {
    await selectFile(file);
    setShowPreview(true);
  };

  /**
   * Handle send action
   */
  const handleSend = async () => {
    try {
      const result = await startUpload();
      if (result) {
        onUploadComplete?.(result);
        // Close preview after a short delay to show "Sent" state
        setTimeout(() => {
          setShowPreview(false);
          reset();
        }, 1500);
      }
    } catch (error) {
      onError?.((error as Error).message);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    cancelUpload();
  };

  /**
   * Handle retry
   */
  const handleRetry = async () => {
    try {
      await retryUpload();
    } catch (error) {
      onError?.((error as Error).message);
    }
  };

  /**
   * Handle remove (close preview without sending)
   */
  const handleRemove = () => {
    cancelUpload();
    setShowPreview(false);
    reset();
  };

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
        onClose={() => setShowAttachmentSheet(false)}
        onFileSelected={handleFileSelected}
        onError={(error) => onError?.(error)}
      />

      {/* Photo Preview */}
      {showPreview && state.file && (
        <PhotoPreview
          file={state.file}
          progress={state.progress}
          status={state.status === 'idle' ? 'pending' : state.status}
          error={state.error || undefined}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onSend={handleSend}
          onRemove={handleRemove}
        />
      )}
    </>
  );
};
