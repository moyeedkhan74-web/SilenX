import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
      }

      if (event.key === 'ArrowRight' && activeIndex >= 0 && activeIndex < mediaItems.length - 1) {
        setActiveMediaMessage(mediaItems[activeIndex + 1]);
      }

      if (event.key === 'ArrowLeft' && activeIndex > 0) {
        setActiveMediaMessage(mediaItems[activeIndex - 1]);
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
    }
  };

  const openPrevious = () => {
    if (activeIndex > 0) {
      setActiveMediaMessage(mediaItems[activeIndex - 1]);
      setZoom(1);
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

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((current) => Math.min(2.5, Math.max(1, Number((current + delta).toFixed(2)))));
  };

  const viewerContent = isImage ? (
    <div className="media-viewer-surface" onWheel={handleWheelZoom}>
      <img
        src={activeMediaMessage.mediaUrl}
        alt={getAttachmentName(activeMediaMessage)}
        className="media-viewer-image"
        style={{ transform: `scale(${zoom})` }}
      />
    </div>
  ) : isVideo ? (
    <div className="media-viewer-surface">
      <video
        src={activeMediaMessage.mediaUrl}
        className="media-viewer-video"
        controls
        playsInline
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

        <div className="media-viewer-header">
          <div className="media-viewer-title">{getAttachmentName(activeMediaMessage)}</div>
          <button className="media-viewer-download-btn" onClick={handleDownload} type="button">
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>

        {viewerContent}
      </div>
    </div>,
    document.body
  );
};
