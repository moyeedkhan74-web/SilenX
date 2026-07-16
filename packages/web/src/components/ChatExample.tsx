import React, { useState } from 'react';
import { PinButton } from './PinButton';
import { MicButton } from './MicButton';
import { MessageManager } from '@silenx/core';
import { VoiceNoteManager } from '@silenx/core';

/**
 * EXAMPLE: How to use PinButton and MicButton together
 * This is a complete message component with pinning and voice recording
 */

interface Message {
  id: string;
  text: string;
  isPinned: boolean;
  senderId: string;
  createdAt: Date;
}

interface MessageComponentProps {
  message: Message;
  chatId: string;
  currentUserId: string;
  messageManager: MessageManager;
  voiceNoteManager: VoiceNoteManager;
}

/**
 * MESSAGE COMPONENT - With PIN BUTTON
 */
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
      console.log('✅ Message pinned!');
    } catch (error) {
      console.error('❌ Failed to pin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId: string) => {
    setLoading(true);
    try {
      await messageManager.unpinMessage(messageId);
      setIsPinned(false);
      console.log('✅ Message unpinned!');
    } catch (error) {
      console.error('❌ Failed to unpin:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="message-item">
      <div className="message-content">
        <p>{message.text}</p>
      </div>
      <div className="message-actions">
        <PinButton
          messageId={message.id}
          isPinned={isPinned}
          onPin={handlePin}
          onUnpin={handleUnpin}
          loading={loading}
        />
      </div>
    </div>
  );
};

/**
 * CHAT INPUT - With MIC BUTTON
 */
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
    console.log('🎤 Starting voice recording...');
    try {
      await voiceNoteManager.startRecording({ format: 'mp3' });
      console.log('✅ Recording started');
    } catch (error) {
      console.error('❌ Recording error:', error);
    }
  };

  const handleRecordingStop = async (filePath: string, duration: number) => {
    console.log(`🎙️  Recording stopped - Duration: ${duration}s`);
    try {
      // Create voice note message
      const voiceNote = await voiceNoteManager.recordVoiceNote(
        chatId,
        currentUserId
      );

      console.log('✅ Voice note saved:', voiceNote);

      // Send message
      const msgData = {
        id: Date.now().toString(),
        chatId,
        senderId: currentUserId,
        content: voiceNote,
        timestamp: new Date(),
      };

      onMessageSent?.(msgData);
    } catch (error) {
      console.error('❌ Failed to save voice note:', error);
    }
  };

  const handleRecordingCancel = () => {
    console.log('❌ Voice recording cancelled');
  };

  return (
    <div className="chat-input-container">
      <input
        type="text"
        placeholder="Type message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="message-input"
      />

      {/* MIC BUTTON */}
      <MicButton
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        onRecordingCancel={handleRecordingCancel}
      />
    </div>
  );
};

/**
 * COMPLETE CHAT COMPONENT
 * Shows both features working together
 */
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
            voiceNoteManager={voiceNoteManager}
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
