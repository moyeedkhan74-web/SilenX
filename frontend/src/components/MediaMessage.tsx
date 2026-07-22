import React from 'react';
import { Download, FileText, PlayCircle } from 'lucide-react';
import type { ChatMessage } from '../types';
import { useChatStore } from '../store/chatStore';

interface MediaMessageProps {
  message: ChatMessage;
}

const isImageMessage = (message: ChatMessage) => {
  if (message.contentType === 'image') return true;
  return typeof message.fileType === 'string' && message.fileType.startsWith('image/');
};

const isVideoMessage = (message: ChatMessage) => {
  if (message.contentType === 'video') return true;
  return typeof message.fileType === 'string' && message.fileType.startsWith('video/');
};

const getAttachmentName = (message: ChatMessage) => message.fileName || message.text || 'Attachment';

const formatFileSize = (message: ChatMessage) => message.fileSize || 'Unknown size';

export const MediaMessage: React.FC<MediaMessageProps> = ({ message }) => {
  const setActiveMediaMessage = useChatStore((state) => state.setActiveMediaMessage);

  const openViewer = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveMediaMessage(message);
  };

  const downloadAttachment = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!message.mediaUrl) return;

    try {
      const response = await fetch(message.mediaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = getAttachmentName(message);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch (error) {
      console.error('Failed to download attachment', error);
    }
  };

  if (isImageMessage(message) && message.mediaUrl) {
    return (
      <button className="media-message-trigger media-image-trigger" onClick={openViewer} type="button">
        <img
          src={message.mediaUrl}
          alt={message.text || getAttachmentName(message)}
          loading="lazy"
          decoding="async"
          className="media-message-image"
        />
      </button>
    );
  }

  if (isVideoMessage(message) && message.mediaUrl) {
    return (
      <button className="media-message-trigger media-video-trigger" onClick={openViewer} type="button">
        <video
          src={message.mediaUrl}
          className="media-message-video"
          playsInline
          muted
          controls
          preload="metadata"
          poster={message.mediaUrl}
        />
        <span className="media-video-play-overlay">
          <PlayCircle size={28} />
        </span>
      </button>
    );
  }

  if (message.mediaUrl) {
    return (
      <div className="media-file-card" onClick={(event) => event.stopPropagation()}>
        <div className="media-file-icon-wrap">
          <FileText size={20} />
        </div>
        <div className="media-file-info">
          <div className="media-file-name">{getAttachmentName(message)}</div>
          <div className="media-file-size">{formatFileSize(message)}</div>
        </div>
        <button className="media-file-download-btn" onClick={downloadAttachment} type="button">
          <Download size={16} />
          <span>Download</span>
        </button>
      </div>
    );
  }

  return null;
};
