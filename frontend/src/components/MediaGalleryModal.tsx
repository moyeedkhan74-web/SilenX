import React, { useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { ChatMessage } from '../types';
import { X, ArrowLeft, FileText, Link } from 'lucide-react';
import Modal from './ui/Modal';
import './MediaGalleryModal.css';

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');
  const [isMediaLightboxOpen, setIsMediaLightboxOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<ChatMessage | null>(null);

  const messages = useChatStore((s) => s.messages[conversationId] || []);

  // Categorize messages
  const mediaMessages = messages.filter(
    (m) => m.contentType === 'image' || m.contentType === 'video'
  );
  const docMessages = messages.filter(
    (m) => m.contentType === 'file'
  );
  const linkMessages = messages.filter(
    (m) => m.contentType === 'text' && m.text?.match(/https?:\/\/\S+/)
  ).map((msg) => {
    // Extract URLs from text
    const urlMatches = msg.text?.match(/https?:\/\/\S+/g) || [];
    return urlMatches.map((url) => ({ url, message: msg }));
  }).flat();

  const toggleTab = (tab: 'media' | 'docs' | 'links') => {
    setActiveTab(tab);
  };

  const openMediaLightbox = (message: ChatMessage) => {
    setSelectedMedia(message);
    setIsMediaLightboxOpen(true);
  };

  const closeMediaLightbox = () => {
    setIsMediaLightboxOpen(false);
    setSelectedMedia(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="media-gallery-modal">
      <div className="media-gallery-container">
        <header className="media-gallery-header">
          <button type="button" className="icon-btn-back" onClick={onClose}>
            <ArrowLeft size={20} />
          </button>
          <h2>Media, links, and docs</h2>
        </header>

        <div className="media-gallery-tabs">
          <button
            className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => toggleTab('media')}
          >
            Media ({mediaMessages.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => toggleTab('docs')}
          >
            Docs ({docMessages.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => toggleTab('links')}
          >
            Links ({linkMessages.length})
          </button>
        </div>

        <div className="media-gallery-content">
          {activeTab === 'media' && (
            <div className="media-grid">
              {mediaMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="media-item"
                  onClick={() => openMediaLightbox(msg)}
                >
                  {msg.contentType === 'image' && (
                    <img
                      src={msg.mediaUrl || ''}
                      alt="Shared image"
                      className="media-img"
                    />
                  )}
                  {msg.contentType === 'video' && (
                    <div className="video-placeholder">
                      <video
                        src={msg.mediaUrl || ''}
                        controls
                        className="media-img"
                      />
                      <div className="video-overlay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="docs-list">
              {docMessages.map((msg) => (
                <div key={msg.id} className="doc-item">
                  <div className="doc-icon">
                    <FileText size={24} />
                  </div>
                  <div className="doc-info">
                    <div className="doc-name">
                      {msg.fileName || 'Unknown file'}
                    </div>
                    <div className="doc-meta">
                      <span className="doc-size">
                        {msg.fileSize ? `${parseInt(msg.fileSize) / 1024} KB` : ''}
                      </span>
                      <span className="doc-date">
                        {new Date(msg.createdAt || msg.time).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="doc-actions">
                    <button
                      className="doc-download-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Trigger download
                        const link = document.createElement('a');
                        link.href = msg.mediaUrl || '';
                        link.download = msg.fileName || 'file';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'links' && (
            <div className="links-list">
              {linkMessages.map((linkObj, index) => (
                <div key={index} className="link-item">
                  <div className="link-icon">
                    <Link size={24} />
                  </div>
                  <div className="link-url">
                    {linkObj.url}
                  </div>
                  <div className="link-actions">
                    <button
                      className="link-copy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(linkObj.url);
                        alert('Link copied to clipboard!');
                      }}
                    >
                      Copy
                    </button>
                    <button
                      className="link-open-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(linkObj.url, '_blank');
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Media Lightbox */}
      {isMediaLightboxOpen && selectedMedia && (
        <div className="media-lightbox-backdrop" onClick={closeMediaLightbox}>
          <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={closeMediaLightbox}>
              <X size={24} />
            </button>
            <div className="lightbox-media">
              {selectedMedia.contentType === 'image' && (
                <img
                  src={selectedMedia.mediaUrl || ''}
                  alt="Shared image"
                  className="lightbox-img"
                />
              )}
              {selectedMedia.contentType === 'video' && (
                <video
                  src={selectedMedia.mediaUrl || ''}
                  controls
                  className="lightbox-img"
                  autoPlay
                />
              )}
            </div>
            <div className="lightbox-footer">
              <div className="lightbox-info">
                <span className="lightbox-filename">
                  {selectedMedia.fileName || 'Shared media'}
                </span>
                <span className="lightbox-date">
                  {new Date(selectedMedia.createdAt || selectedMedia.time).toLocaleString()}
                </span>
              </div>
              <div className="lightbox-actions">
                <button
                  className="lightbox-download-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Trigger download
                    const link = document.createElement('a');
                    link.href = selectedMedia.mediaUrl || '';
                    link.download = selectedMedia.fileName || 'file';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MediaGalleryModal;