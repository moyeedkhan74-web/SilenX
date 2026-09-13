import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Copy, Check } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import type { ChatMessage } from '../types';

const isMediaMessage = (message: ChatMessage) => {
  if (!message.mediaUrl) return false;
  const mimeType = message.fileType || '';
  return message.contentType === 'image' || message.contentType === 'video' || mimeType.startsWith('image/') || mimeType.startsWith('video/');
};

const getAttachmentName = (message: ChatMessage) => message.fileName || message.text || 'Attachment';

export const MediaViewer: React.FC = () => {
  const activeMediaMessage = useChatStore((state) => state.activeMediaMessage);
  const setActiveMediaMessage = useChatStore((state) => state.setActiveMediaMessage);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messages = useChatStore((state) => state.messages);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);

  const mediaItems = useMemo(() => {
    if (!activeConversationId) return [] as ChatMessage[];
    return (messages[activeConversationId] || []).filter(isMediaMessage);
  }, [activeConversationId, messages]);

  const activeIndex = useMemo(() => {
    if (!activeMediaMessage) return -1;
    return mediaItems.findIndex((item) => item.id === activeMediaMessage.id);
  }, [activeMediaMessage, mediaItems]);

  const isOpen = Boolean(activeMediaMessage && activeMediaMessage.mediaUrl);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMediaMessage(null);
      } else if (event.key === 'ArrowRight' && activeIndex >= 0 && activeIndex < mediaItems.length - 1) {
        setActiveMediaMessage(mediaItems[activeIndex + 1]);
        setZoom(1);
        setRotation(0);
      } else if (event.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveMediaMessage(mediaItems[activeIndex - 1]);
        setZoom(1);
        setRotation(0);
      } else if (event.key === '=' || event.key === '+') {
        setZoom((z) => Math.min(3, z + 0.2));
      } else if (event.key === '-') {
        setZoom((z) => Math.max(0.5, z - 0.2));
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, isOpen, mediaItems, setActiveMediaMessage]);

  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen]);

  if (!isOpen || !activeMediaMessage) return null;

  const mimeType = activeMediaMessage.fileType || '';
  const isImage = activeMediaMessage.contentType === 'image' || mimeType.startsWith('image/');
  const isVideo = activeMediaMessage.contentType === 'video' || mimeType.startsWith('video/');

  const closeViewer = () => {
    setActiveMediaMessage(null);
  };

  const openNext = () => {
    if (activeIndex >= 0 && activeIndex < mediaItems.length - 1) {
      setActiveMediaMessage(mediaItems[activeIndex + 1]);
      setZoom(1);
      setRotation(0);
    }
  };

  const openPrevious = () => {
    if (activeIndex > 0) {
      setActiveMediaMessage(mediaItems[activeIndex - 1]);
      setZoom(1);
      setRotation(0);
    }
  };

  const handleDownload = async () => {
    if (!activeMediaMessage.mediaUrl) return;

    try {
      const response = await fetch(activeMediaMessage.mediaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = getAttachmentName(activeMediaMessage);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch (error) {
      console.error('Failed to download media from viewer', error);
    }
  };

  const handleCopyImage = async () => {
    if (!activeMediaMessage.mediaUrl || !isImage) return;
    try {
      const response = await fetch(activeMediaMessage.mediaUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image to clipboard', err);
    }
  };

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    setZoom((current) => Math.min(3, Math.max(0.5, Number((current + delta).toFixed(2)))));
  };

  const viewerContent = isImage ? (
    <div className="media-viewer-surface" onWheel={handleWheelZoom}>
      <img
        src={activeMediaMessage.mediaUrl}
        alt={getAttachmentName(activeMediaMessage)}
        className="media-viewer-image"
        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 150ms ease-out' }}
      />
    </div>
  ) : isVideo ? (
    <div className="media-viewer-surface">
      <video
        src={activeMediaMessage.mediaUrl}
        className="media-viewer-video"
        controls
        playsInline
        autoPlay
        preload="metadata"
        poster={activeMediaMessage.mediaUrl}
      />
    </div>
  ) : null;

  return createPortal(
    <div className="media-viewer-overlay" onClick={(event) => event.target === event.currentTarget && closeViewer()}>
      <div className="media-viewer-card" role="dialog" aria-modal="true">
        <button className="media-viewer-close-btn" onClick={closeViewer} type="button" aria-label="Close media viewer">
          <X size={22} />
        </button>

        {activeIndex > 0 && (
          <button className="media-viewer-nav media-viewer-nav-left" onClick={openPrevious} type="button" aria-label="Previous attachment">
            <ChevronLeft size={24} />
          </button>
        )}

        {activeIndex >= 0 && activeIndex < mediaItems.length - 1 && (
          <button className="media-viewer-nav media-viewer-nav-right" onClick={openNext} type="button" aria-label="Next attachment">
            <ChevronRight size={24} />
          </button>
        )}

        {/* Top Header Bar */}
        <div className="media-viewer-header">
          <div className="media-viewer-title">{getAttachmentName(activeMediaMessage)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isImage && (
              <>
                <button
                  className="media-viewer-download-btn"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  type="button"
                  title="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  className="media-viewer-download-btn"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  type="button"
                  title="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  className="media-viewer-download-btn"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  type="button"
                  title="Rotate"
                >
                  <RotateCw size={16} />
                </button>
                <button
                  className="media-viewer-download-btn"
                  onClick={handleCopyImage}
                  type="button"
                  title="Copy Image"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </>
            )}
            <button className="media-viewer-download-btn" onClick={handleDownload} type="button">
              <Download size={16} />
              <span>Download</span>
            </button>
          </div>
        </div>

        {viewerContent}

        {/* Bottom Conversation Media Filmstrip */}
        {mediaItems.length > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            overflowX: 'auto'
          }}>
            {mediaItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveMediaMessage(item);
                  setZoom(1);
                  setRotation(0);
                }}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: idx === activeIndex ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer',
                  opacity: idx === activeIndex ? 1 : 0.6,
                  flexShrink: 0,
                  transition: 'all 150ms ease'
                }}
              >
                {item.contentType === 'video' ? (
                  <video src={item.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={item.mediaUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

