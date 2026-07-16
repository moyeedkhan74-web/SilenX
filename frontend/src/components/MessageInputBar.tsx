import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Send, Smile, X, Paperclip, Mic, Square } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { AttachmentMenu } from './AttachmentMenu';
import type { ChatMessage } from '../types';

interface ReplyTo {
  sender: string;
  text: string;
}

interface MessageInputBarProps {
  onSend?: (payload: { text: string; replyTo?: ReplyTo }) => void;
  onSendRichMessage?: (msg: Partial<ChatMessage>) => void;
  replyTo?: ReplyTo;
  onCancelReply?: () => void;
  onTypingChange?: (isTyping: boolean) => void;
}

const TABS = ['emoji', 'sticker', 'gif'] as const;
type PickerTab = (typeof TABS)[number];

export function MessageInputBar({ onSend, onSendRichMessage, replyTo, onCancelReply, onTypingChange }: MessageInputBarProps) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>('emoji');
  const [attachOpen, setAttachOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const isDark = useMemo(() => document.documentElement.getAttribute('data-theme') === 'dark', [pickerOpen]);

  const handleEmoji = (emoji: { native?: string }) => {
    setText((current) => current + (emoji.native || ''));
    textRef.current?.focus();
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onTypingChange?.(false);
    onSend?.({ text: text.trim(), replyTo });
    setText('');
    setPickerOpen(false);
    setAttachOpen(false);
    onCancelReply?.();
  };

  // ─── Voice recording ───
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const durationSec = recordingTime;
          const mm = String(Math.floor(durationSec / 60)).padStart(2, '0');
          const ss = String(durationSec % 60).padStart(2, '0');
          onSendRichMessage?.({
            text: `🎤 Voice note (${mm}:${ss})`,
            contentType: 'voice-note',
            mediaUrl: dataUrl,
            duration: `${mm}:${ss}`,
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch {
      alert('Microphone access is required for voice notes.');
    }
  }, [onSendRichMessage, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // ─── Attachment callbacks ───
  const handleSendImage = (dataUrl: string) => {
    onSendRichMessage?.({ text: '📷 Photo', contentType: 'image', mediaUrl: dataUrl });
  };
  const handleSendCamera = (dataUrl: string) => {
    onSendRichMessage?.({ text: '📸 Camera photo', contentType: 'image', mediaUrl: dataUrl });
  };
  const handleSendDocument = (data: { fileName: string; fileSize: string; dataUrl: string; fileType?: string }) => {
    const contentType = data.fileType?.startsWith('video/')
      ? 'video'
      : data.fileType?.startsWith('image/')
      ? 'image'
      : 'file';

    const displayText = contentType === 'video'
      ? `🎬 ${data.fileName}`
      : `📄 ${data.fileName}`;

    onSendRichMessage?.({
      text: displayText,
      contentType,
      mediaUrl: data.dataUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
    });
  };
  const handleSendLocation = (data: { latitude: number; longitude: number; description: string }) => {
    onSendRichMessage?.({ text: `📍 ${data.description}`, contentType: 'location', locationData: data });
  };
  const handleSendContact = (data: { name: string; uid: string }) => {
    onSendRichMessage?.({ text: `👤 ${data.name}`, contentType: 'contact', contactData: data });
  };
  const handleSendPoll = (data: { question: string; options: string[] }) => {
    const pollData = {
      question: data.question,
      options: data.options.map((opt, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text: opt,
        votes: [] as string[],
      })),
    };
    onSendRichMessage?.({ text: `📊 Poll: ${data.question}`, contentType: 'poll', pollData });
  };
  const handleSendEvent = (data: { title: string; date: string; time: string; description?: string; location?: string }) => {
    onSendRichMessage?.({ text: `📅 ${data.title}`, contentType: 'event', eventData: data });
  };

  const formatTime = (secs: number) => {
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return (
    <div className="input-bar-wrapper" style={{ position: 'relative' }}>
      {replyTo && (
        <div className="reply-banner">
          <div className="reply-banner-content">
            <span className="reply-banner-name">Replying to {replyTo.sender}</span>
            <span className="reply-banner-text">{replyTo.text}</span>
          </div>
          <button className="icon-btn-sm" onClick={onCancelReply} type="button">
            <X size={14} />
          </button>
        </div>
      )}

      {pickerOpen && (
        <div className="picker-panel">
          <div className="picker-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`picker-tab ${pickerTab === tab ? 'active' : ''}`}
                onClick={() => setPickerTab(tab)}
                type="button"
              >
                {tab === 'emoji' && <Smile size={18} />}
                {tab === 'sticker' && '🎭'}
                {tab === 'gif' && 'GIF'}
              </button>
            ))}
          </div>

          {pickerTab === 'emoji' && (
            <Picker
              data={data}
              onEmojiSelect={handleEmoji}
              theme={isDark ? 'dark' : 'light'}
              previewPosition="none"
              skinTonePosition="none"
            />
          )}
          {pickerTab === 'sticker' && (
            <div className="sticker-grid">
              {['🎉', '🎊', '🎈', '🥳', '🎁', '🏆', '❤️', '💪', '🔥', '✨', '🌟', '💯'].map((sticker) => (
                <button
                  key={sticker}
                  className="sticker-btn"
                  onClick={() => {
                    onSend?.({ text: sticker });
                    setPickerOpen(false);
                  }}
                  type="button"
                >
                  {sticker}
                </button>
              ))}
            </div>
          )}
          {pickerTab === 'gif' && (
            <div className="gif-placeholder">
              <p>GIF search — connect to GIPHY API</p>
            </div>
          )}
        </div>
      )}

      <AttachmentMenu
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onSendImage={handleSendImage}
        onSendCamera={handleSendCamera}
        onSendLocation={handleSendLocation}
        onSendContact={handleSendContact}
        onSendDocument={handleSendDocument}
        onSendPoll={handleSendPoll}
        onSendEvent={handleSendEvent}
      />

      <div className="input-row">
        <button className="input-icon-btn" onClick={() => { setPickerOpen((open) => !open); setAttachOpen(false); }} type="button">
          <Smile size={22} />
        </button>

        {isRecording ? (
          <div className="voice-recording-bar">
            <div className="voice-recording-dot" />
            <span className="voice-recording-time">{formatTime(recordingTime)}</span>
            <span className="voice-recording-label">Recording...</span>
          </div>
        ) : (
          <div className="input-box">
            <textarea
              ref={textRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                onTypingChange?.(event.target.value.trim().length > 0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onTypingChange?.(false);
                  handleSend();
                }
              }}
              placeholder="Type a secure message..."
              rows={1}
              className="msg-textarea"
            />
          </div>
        )}

        <button
          className="input-icon-btn attach-btn"
          onClick={() => { setAttachOpen((o) => !o); setPickerOpen(false); }}
          type="button"
          title="Attach"
        >
          <Paperclip size={22} />
        </button>

        {text.trim() ? (
          <button className="send-btn active" onClick={handleSend} type="button">
            <Send size={18} />
          </button>
        ) : isRecording ? (
          <button className="send-btn active voice-stop-btn" onClick={stopRecording} type="button" title="Stop recording">
            <Square size={18} />
          </button>
        ) : (
          <button className="send-btn mic-btn active" onClick={startRecording} type="button" title="Record voice note">
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default MessageInputBar;
