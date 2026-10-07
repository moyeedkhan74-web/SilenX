/** @jsxImportSource react */
// src/components/AttachmentSheet.tsx
// Bottom sheet for choosing media source
// Camera, Gallery, Document options (Step 2: Camera & Gallery for photos only)

import { useState } from 'react';
import { Camera, Image, FileText } from 'lucide-react';
import { useMediaUpload } from '../hooks/useMediaUpload';

export interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
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
      className="attachment-action"
    >
      <div className="attachment-icon">{icon}</div>
      <div className="attachment-text">
        <span className="attachment-label">{label}</span>
        <span className="attachment-desc">{description}</span>
      </div>
    </button>
  );
};

export const AttachmentSheet = ({
  isOpen,
  onClose,
  onPickCamera,
  onPickGallery,
  onPickDocument,
}: AttachmentSheetProps) => {
  if (!isOpen) return null;

  return (
    <div className="attachment-sheet-backdrop" onClick={onClose}>
      <div
        className="attachment-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="attachment-handle" />
        <h3 className="attachment-title">Send Photo</h3>

        <div className="attachment-actions">
          <ActionButton
            icon={<Camera size={22} />}
            label="Camera"
            description="Take a new photo"
            onClick={() => {
              onPickCamera();
              onClose();
            }}
          />
          <ActionButton
            icon={<Image size={22} />}
            label="Gallery"
            description="Choose from your photos"
            onClick={() => {
              onPickGallery();
              onClose();
            }}
          />
          <ActionButton
            icon={<FileText size={22} />}
            label="Document"
            description="Coming in next step"
            onClick={() => {
              onClose();
              onPickDocument();
            }}
          />
        </div>

        <button type="button" onClick={onClose} className="attachment-cancel">
          Cancel
        </button>
      </div>
    </div>
  );
};
