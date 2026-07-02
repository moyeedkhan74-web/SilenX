import { useMemo, useRef, useState } from 'react';
import { Send, Smile, X } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface ReplyTo {
  sender: string;
  text: string;
}

interface MessageInputBarProps {
  onSend?: (payload: { text: string; replyTo?: ReplyTo }) => void;
  replyTo?: ReplyTo;
  onCancelReply?: () => void;
  onTypingChange?: (isTyping: boolean) => void;
}

const TABS = ['emoji', 'sticker', 'gif'] as const;
type PickerTab = (typeof TABS)[number];

export function MessageInputBar({ onSend, replyTo, onCancelReply, onTypingChange }: MessageInputBarProps) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>('emoji');
  const textRef = useRef<HTMLTextAreaElement>(null);

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
    onCancelReply?.();
  };

  return (
    <div className="input-bar-wrapper">
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

      <div className="input-row">
        <button className="input-icon-btn" onClick={() => setPickerOpen((open) => !open)} type="button">
          <Smile size={22} />
        </button>

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

        <button className={`send-btn ${text.trim() ? 'active' : ''}`} onClick={handleSend} disabled={!text.trim()} type="button">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

export default MessageInputBar;
