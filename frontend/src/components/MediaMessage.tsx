import React, { useState } from 'react';
import { Download, FileText, PlayCircle, Music, FileCode, Archive, FileSpreadsheet } from 'lucide-react';
import type { ChatMessage } from '../types';
import { useChatStore } from '../store/chatStore';
import VoiceNotePlayer from './VoiceNotePlayer';
import { ViewOnceMediaBubble } from './ViewOnceMediaBubble';

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

const isVoiceMessage = (message: ChatMessage) => {
  if (message.contentType === 'voice-note') return true;
  return (
    typeof message.fileType === 'string' &&
    (message.fileType.startsWith('audio/') || message.fileType === 'audio/webm')
  );
};

const getAttachmentName = (message: ChatMessage) => message.fileName || message.text || 'Attachment';

const formatFileSize = (message: ChatMessage) => {
  if (!message.fileSize) return 'Document';
  if (message.fileSize.includes('KB') || message.fileSize.includes('MB')) return message.fileSize;
  const num = parseFloat(message.fileSize);
  if (isNaN(num)) return message.fileSize;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
};

const getDocMeta = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') {
    return { icon: <FileText size={20} />, bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'PDF' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { icon: <Archive size={20} />, bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'ZIP' };
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'cpp', 'c', 'cs', 'php'].includes(ext)) {
    return { icon: <FileCode size={20} />, bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', label: ext.toUpperCase() };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { icon: <FileSpreadsheet size={20} />, bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: ext.toUpperCase() };
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return { icon: <Music size={20} />, bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', label: ext.toUpperCase() };
  }
  return { icon: <FileText size={20} />, bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: ext.toUpperCase() || 'FILE' };
};

export const MediaMessage: React.FC<MediaMessageProps> = ({ message }) => {
  const setActiveMediaMessage = useChatStore((state) => state.setActiveMediaMessage);
  const [viewOnceOpened, setViewOnceOpened] = useState(false);

  // Mark view-once as opened
  const markViewOnceOpened = (messageId: string) => {
    setViewOnceOpened(true);
    console.log('[MediaMessage] View-once message opened:', messageId);
  };

  // Render view-once media first
  if (message.contentType === 'view-once' && message.isViewOnce && !viewOnceOpened) {
    return <ViewOnceMediaBubble message={message} onViewOnceOpened={() => markViewOnceOpened(message.id)} />;
  }

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

  if (isVoiceMessage(message) && message.mediaUrl) {
    return (
      <div onClick={(event) => event.stopPropagation()}>
        <VoiceNotePlayer
          mediaUrl={message.mediaUrl}
          seedId={message.id || 'voice'}
          durationHint={message.duration}
        />
      </div>
    );
  }

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
    const docMeta = getDocMeta(getAttachmentName(message));
    return (
      <div className="media-file-card" onClick={(event) => event.stopPropagation()}>
        <div className="media-file-icon-wrap" style={{ background: docMeta.bg, color: docMeta.color }}>
          {docMeta.icon}
        </div>
        <div className="media-file-info">
          <div className="media-file-name">{getAttachmentName(message)}</div>
          <div className="media-file-size" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: docMeta.bg, color: docMeta.color }}>
              {docMeta.label}
            </span>
            <span>{formatFileSize(message)}</span>
          </div>
        </div>
        <button className="media-file-download-btn" onClick={downloadAttachment} type="button">
          <Download size={15} />
          <span>Download</span>
        </button>
      </div>
    );
  }

  return null;
};