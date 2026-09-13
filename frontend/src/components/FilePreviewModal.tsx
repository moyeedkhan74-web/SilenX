import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Send, Plus, Eye, FileText, Music, Video as VideoIcon, FileCode, Archive } from 'lucide-react';
import './FilePreviewModal.css';

export interface StagedFileItem {
  file: File;
  previewUrl: string;
  category: 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'archive' | 'code' | 'other';
}

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: File[];
  onSend: (payload: { files: File[]; caption: string; isViewOnce: boolean }) => void;
  onRemoveFile: (index: number) => void;
  onAddFiles: (newFiles: File[]) => void;
}

const getFileCategory = (file: File): StagedFileItem['category'] => {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'archive';
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb'].includes(ext)) {
    return 'code';
  }
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv'].includes(ext)) {
    return 'doc';
  }
  return 'other';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  onSend,
  onRemoveFile,
  onAddFiles,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Maintain object URLs for previews
  const stagedItems = useMemo<StagedFileItem[]>(() => {
    return files.map((file) => {
      const category = getFileCategory(file);
      const previewUrl = URL.createObjectURL(file);
      return { file, previewUrl, category };
    });
  }, [files]);

  // Clean up object URLs on unmount/update
  useEffect(() => {
    return () => {
      stagedItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [stagedItems]);

  // Bounds check activeIndex
  useEffect(() => {
    if (activeIndex >= files.length) {
      setActiveIndex(Math.max(0, files.length - 1));
    }
  }, [files.length, activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && activeIndex < files.length - 1) {
        setActiveIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, files.length, onClose]);

  if (!isOpen || files.length === 0) return null;

  const activeItem = stagedItems[activeIndex] || stagedItems[0];
  const totalBatchSize = files.reduce((acc, f) => acc + f.size, 0);

  const handleSendClick = () => {
    onSend({ files, caption: caption.trim(), isViewOnce });
    setCaption('');
    setIsViewOnce(false);
  };

  const handleAddFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      onAddFiles(selected);
    }
    e.target.value = '';
  };

  const renderIconForCategory = (category: StagedFileItem['category']) => {
    switch (category) {
      case 'video':
        return <VideoIcon size={18} />;
      case 'audio':
        return <Music size={18} />;
      case 'code':
        return <FileCode size={18} />;
      case 'archive':
        return <Archive size={18} />;
      case 'pdf':
      case 'doc':
      default:
        return <FileText size={18} />;
    }
  };

  return (
    <div className="file-preview-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="file-preview-dialog" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="file-preview-header">
          <div className="file-preview-header-info">
            <h3 className="file-preview-title">
              Send {files.length} {files.length === 1 ? 'file' : 'files'}
            </h3>
            <span className="file-preview-meta-tag">
              Total {formatFileSize(totalBatchSize)}
            </span>
          </div>
          <button
            className="file-preview-close-btn"
            onClick={onClose}
            type="button"
            aria-label="Close file preview"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Stage */}
        <div className="file-preview-body">
          {activeItem && (
            <div className="file-preview-stage">
              {activeItem.category === 'image' ? (
                <img
                  src={activeItem.previewUrl}
                  alt={activeItem.file.name}
                  className="file-preview-img-active"
                />
              ) : activeItem.category === 'video' ? (
                <video
                  src={activeItem.previewUrl}
                  controls
                  className="file-preview-video-active"
                />
              ) : activeItem.category === 'audio' ? (
                <div className="file-preview-audio-card">
                  <div className="file-preview-doc-icon-wrap" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }}>
                    <Music size={36} />
                  </div>
                  <div className="file-preview-doc-name">{activeItem.file.name}</div>
                  <div className="file-preview-doc-meta">
                    <span className="file-preview-ext-badge">{activeItem.file.name.split('.').pop()}</span>
                    <span>{formatFileSize(activeItem.file.size)}</span>
                  </div>
                  <audio src={activeItem.previewUrl} controls className="file-preview-audio-player" />
                </div>
              ) : (
                <div className="file-preview-doc-card">
                  <div className="file-preview-doc-icon-wrap">
                    {renderIconForCategory(activeItem.category)}
                  </div>
                  <div className="file-preview-doc-name">{activeItem.file.name}</div>
                  <div className="file-preview-doc-meta">
                    <span className="file-preview-ext-badge">{activeItem.file.name.split('.').pop() || 'file'}</span>
                    <span>{formatFileSize(activeItem.file.size)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Carousel Thumbnail Strip */}
        <div className="file-preview-strip">
          {stagedItems.map((item, idx) => (
            <div
              key={idx}
              className={`file-preview-thumb-item ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(idx)}
            >
              <button
                className="file-preview-thumb-remove"
                title="Remove file"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(idx);
                }}
              >
                <X size={12} />
              </button>

              {item.category === 'image' ? (
                <img src={item.previewUrl} alt={item.file.name} className="file-preview-thumb-img" />
              ) : (
                <div className="file-preview-thumb-icon">
                  {renderIconForCategory(item.category)}
                  <span>{item.file.name.split('.').pop()?.slice(0, 4)}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add more files button */}
          <button
            className="file-preview-add-btn"
            title="Add more files"
            type="button"
            onClick={() => addFileInputRef.current?.click()}
          >
            <Plus size={20} />
            <span>Add</span>
          </button>
          <input
            ref={addFileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleAddFilesSelected}
          />
        </div>

        {/* Footer Toolbar */}
        <div className="file-preview-footer">
          {(activeItem?.category === 'image' || activeItem?.category === 'video') && (
            <div className="file-preview-options-row">
              <label className="file-preview-viewonce-toggle">
                <input
                  type="checkbox"
                  checked={isViewOnce}
                  onChange={(e) => setIsViewOnce(e.target.checked)}
                  className="file-preview-viewonce-checkbox"
                />
                <Eye size={16} style={{ color: isViewOnce ? '#6366f1' : '#9ca3af' }} />
                <span>Send as View-Once (disappears after opening)</span>
              </label>
            </div>
          )}

          <div className="file-preview-caption-row">
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="file-preview-caption-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendClick();
                }
              }}
            />
            <button
              className="file-preview-send-btn"
              onClick={handleSendClick}
              type="button"
            >
              <Send size={16} />
              <span>Send ({files.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
