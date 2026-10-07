/** @jsxImportSource react */
// src/components/MediaCard.tsx
// Media card for displaying an uploading/uploaded photo with progress and controls

import { Pause, Play, Download, X, RefreshCw, AlertCircle } from 'lucide-react';
import { MediaItem, MediaStatus } from '../types/media';

export interface MediaCardProps {
  item: MediaItem;
  showThumbnail?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
}

export const MediaCard = ({
  item,
  showThumbnail = true,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDownload,
}: MediaCardProps) => {
  const isImage = item.mimeType.startsWith('image/');
  const isVideo = item.mimeType.startsWith('video/');

  const getStatusColor = (): string => {
    switch (item.status) {
      case 'done':
        return '#00a884';
      case 'failed':
        return '#f15c6d';
      case 'uploading':
      case 'paused':
      case 'queued':
        return '#8696a0';
      default:
        return '#8696a0';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
  };

  return (
    <div className="media-card" data-status={item.status}>
      {/* Thumbnail or icon */}
      {showThumbnail && item.thumbnailUrl && (
        <div className="media-card-thumbnail-wrapper">
          <img
            src={item.thumbnailUrl}
            alt={item.fileName}
            className="media-card-thumbnail"
            loading="lazy"
          />
          {(item.status === 'queued' || item.status === 'uploading') && item.progress < 100 && (
            <div
              className="media-card-progress-overlay"
              style={{ '--progress': `${item.progress}%`} as React.CSSProperties}
            />
          )}
        </div>
      )}

      {!showThumbnail || (!item.thumbnailUrl && isVideo) ? (
        <div className="media-card-icon-wrapper">
          {isVideo ? (
            <Play size={24} className="media-card-icon" />
          ) : (
            <Download size={24} className="media-card-icon" />
          )}
        </div>
      ) : null}

      {/* File info */}
      <div className="media-card-info">
        <div className="media-card-name">{item.fileName}</div>
        <div className="media-card-size">{formatFileSize(item.size)}</div>
      </div>

      {/* Status */}
      <div className="media-card-status" style={{ color: getStatusColor() }}>
        {item.status === 'uploading' && `${item.progress}% uploading`}
        {item.status === 'queued' && 'Queued'}
        {item.status === 'paused' && 'Paused'}
        {item.status === 'done' && 'Done'}
        {item.status === 'failed' && (item.error || 'Failed')}
      </div>

      {/* Error indicator */}
      {item.status === 'failed' && item.error && (
        <div className="media-card-error">
          <AlertCircle size={14} />
          {item.error}
        </div>
      )}

      {/* Action buttons */}
      <div className="media-card-actions">
        {item.status === 'uploading' && onPause && (
          <button
            type="button"
            onClick={onPause}
            className="media-card-action-btn"
            aria-label="Pause"
          >
            <Pause size={16} />
          </button>
        )}
        {item.status === 'paused' && onResume && (
          <button
            type="button"
            onClick={onResume}
            className="media-card-action-btn"
            aria-label="Resume"
          >
            <Play size={16} />
          </button>
        )}
        {item.status === 'failed' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="media-card-action-btn"
            aria-label="Retry"
          >
            <RefreshCw size={16} />
          </button>
        )}
        {item.status === 'done' && onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="media-card-action-btn"
            aria-label="Download"
          >
            <Download size={16} />
          </button>
        )}
        {(item.status === 'uploading' ||
          item.status === 'queued' ||
          item.status === 'paused' ||
          item.status === 'failed') && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="media-card-action-btn"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

// Inline styles for simplicity
const styles = `
.media-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--card-bg, #1f2c34);
  border-radius: 12px;
  border: 1px solid var(--border-color, #374045);
}

.media-card-thumbnail-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
  background: #2a3842;
}

.media-card-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-card-progress-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4px;
  background: linear-gradient(90deg, #00a884 0%, #008f72 100%);
  width: var(--progress, 0%);
  transition: width 0.2s ease;
}

.media-card-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16/9;
  background: #2a3842;
  border-radius: 8px;
}

.media-card-icon {
  color: var(--text-secondary, #8696a0);
}

.media-card-info {
  overflow: hidden;
}

.media-card-name {
  color: var(--text-primary, #e9edef);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-card-size {
  color: var(--text-secondary, #8696a0);
  font-size: 12px;
}

.media-card-status {
  font-size: 12px;
  font-weight: 500;
}

.media-card-error {
  color: var(--error-color, #f15c6d);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.media-card-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 4px;
}

.media-card-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-secondary, #8696a0);
  transition: background 0.2s, color 0.2s;
}

.media-card-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #e9edef);
}

@media (prefers-color-scheme: dark) {
  .media-card {
    background: var(--card-bg-dark, #1a272e);
    border-color: var(--border-color-dark, #2a3842);
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'media-card-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = styles;
    document.head.appendChild(style);
  }
}
