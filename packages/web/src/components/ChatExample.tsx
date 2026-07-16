import React, { useState } from 'react';
import { PinButton } from './PinButton';
import { MicButton } from './MicButton';
import { MessageManager } from '@silenx/core';
import { VoiceNoteManager } from '@silenx/core';
import './ChatExample.css';

/**
 * Example message data supporting text and image messages.
 */
interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  caption?: string;
  isPinned: boolean;
  createdAt: Date;
}

interface MessageComponentProps {
  message: Message;
  chatId: string;
  currentUserId: string;
  messageManager: MessageManager;
}

const ACTION_OPTIONS = [
  { label: 'Reply', icon: '↩️' },
  { label: 'Forward', icon: '📤' },
  { label: 'Save', icon: '⭐' },
  { label: 'Share', icon: '🔗' },
];

export const MessageWithPin: React.FC<MessageComponentProps> = ({
  message,
  chatId,
  currentUserId,
  messageManager,
}) => {
  const [isPinned, setIsPinned] = useState(message.isPinned);
  const [loading, setLoading] = useState(false);

  const handlePin = async (messageId: string) => {
    setLoading(true);
    try {
      await messageManager.pinMessage(messageId, currentUserId);
      setIsPinned(true);
    } catch (error) {
      console.error('Failed to pin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId: string) => {
    setLoading(true);
    try {
      await messageManager.unpinMessage(messageId);
      setIsPinned(false);
    } catch (error) {
      console.error('Failed to unpin:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderImageMessage = () => (
    <div className="image-message">
      <img
        className="image-preview"
        src={message.imageUrl}
        alt={message.caption || 'Shared photo'}
      />
      <div className="image-overlay">
        <div className="image-topbar">
          <PinButton
            messageId={message.id}
            isPinned={isPinned}
            onPin={handlePin}
            onUnpin={handleUnpin}
            loading={loading}
          />
        </div>
      </div>
      <div className="image-caption">
        <span className="image-caption-text">{message.caption || 'Shared photo'}</span>
        <div className="image-actions">
          {ACTION_OPTIONS.map((option) => (
            <button key={option.label} className="image-action" type="button">
              <span>{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`message-item ${isPinned ? 'pinned' : ''}`}>
      <div className="message-header">
        <span className="message-sender">SilenX</span>
        <span className="message-timestamp">
          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {message.imageUrl ? (
        renderImageMessage()
      ) : (
        <div className="message-bubble">
          {message.text}
        </div>
      )}

      {!message.imageUrl && (
        <div className="message-actions">
          <PinButton
            messageId={message.id}
            isPinned={isPinned}
            onPin={handlePin}
            onUnpin={handleUnpin}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

interface ChatInputProps {
  chatId: string;
  currentUserId: string;
  voiceNoteManager: VoiceNoteManager;
  onMessageSent?: (message: any) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  chatId,
  currentUserId,
  voiceNoteManager,
  onMessageSent,
}) => {
  const [message, setMessage] = useState('');

  const handleRecordingStart = async () => {
    try {
      await voiceNoteManager.startVoiceNoteRecording(chatId, currentUserId, { format: 'mp3' });
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const handleRecordingStop = async (duration: number) => {
    try {
      const voiceNote = await voiceNoteManager.stopVoiceNoteRecording();
      onMessageSent?.({
        id: Date.now().toString(),
        chatId,
        senderId: currentUserId,
        text: 'Voice note',
        isPinned: false,
        createdAt: new Date(),
        voiceNote,
      });
    } catch (error) {
      console.error('Failed to save voice note:', error);
    }
  };

  const handleRecordingCancel = async () => {
    try {
      await voiceNoteManager.cancelRecording();
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  return (
    <div className="chat-input-container">
      <input
        type="text"
        placeholder="Write a message or record voice note..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="message-input"
      />

      <MicButton
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        onRecordingCancel={handleRecordingCancel}
      />
    </div>
  );
};

export const ChatComponent: React.FC<{
  chatId: string;
  messages: Message[];
  currentUserId: string;
  messageManager: MessageManager;
  voiceNoteManager: VoiceNoteManager;
}> = ({
  chatId,
  messages,
  currentUserId,
  messageManager,
  voiceNoteManager,
}) => {
  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.map((msg) => (
          <MessageWithPin
            key={msg.id}
            message={msg}
            chatId={chatId}
            currentUserId={currentUserId}
            messageManager={messageManager}
          />
        ))}
      </div>

      <ChatInput
        chatId={chatId}
        currentUserId={currentUserId}
        voiceNoteManager={voiceNoteManager}
        onMessageSent={(msg) => console.log('Message sent:', msg)}
      />
    </div>
  );
};

export default ChatComponent;
