import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Send, Smile, X, Paperclip, Mic, Sticker } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { AttachmentMenu } from './AttachmentMenu';
import VoiceRecorderBar from './VoiceRecorderBar';
import { MediaProgressRing } from './MediaProgressRing';
import { FilePreviewModal } from './FilePreviewModal';
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

interface GiphyGifResult {
  id: string;
  title: string;
  preview: string;
  url: string;
}

const TABS = ['emoji', 'sticker', 'gif'] as const;
type PickerTab = (typeof TABS)[number];

export function MessageInputBar({ onSend, onSendRichMessage, replyTo, onCancelReply, onTypingChange }: MessageInputBarProps) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>('emoji');
  const [attachOpen, setAttachOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GiphyGifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const giphyRequestId = useRef(0);

  const isDark = useMemo(() => document.documentElement.getAttribute('data-theme') === 'dark', [pickerOpen]);

  const handleEmoji = (emoji: { native?: string }) => {
    setText((current) => current + (emoji.native || ''));
    textRef.current?.focus();
  };

  useEffect(() => {
    if (replyTo) {
      textRef.current?.focus();
    }
  }, [replyTo]);

  // Handle clipboard paste of images/files
  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const pasted = Array.from(e.clipboardData.files);
      setStagedFiles((prev) => [...prev, ...pasted]);
    }
  };

  const searchGifs = useCallback(async (query: string) => {
    const apiKey = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined)?.trim() || 'FJc0d6OAjgypqFa3I1rCIQuiGieP8qVs';
    if (!apiKey) {
      setGifError('Set VITE_GIPHY_API_KEY to enable GIF search.');
      setGifResults([]);
      return;
    }

    setGifLoading(true);
    setGifError('');
    const requestId = ++giphyRequestId.current;
    const endpoint = query.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&limit=18&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(apiKey)}&limit=18&rating=g`;

    try {
      const response = await fetch(endpoint);
      const payload = await response.json() as { data?: Array<any> };
      if (!response.ok || !payload.data) {
        throw new Error('Giphy request failed');
      }

      const results = (payload.data || [])
        .map((item: any) => ({
          id: item?.id || `${Date.now()}-${Math.random()}`,
          title: item?.title || 'GIF',
          preview: item?.images?.fixed_width_small?.url || item?.images?.downsized?.url || item?.images?.original?.url || '',
          url: item?.images?.original?.url || item?.images?.downsized_large?.url || item?.images?.fixed_width?.url || '',
        }))
        .filter((item: GiphyGifResult) => item.preview && item.url);

      if (requestId === giphyRequestId.current) {
        setGifResults(results);
      }
    } catch (error) {
      console.error('[MessageInputBar] Failed to load GIFs', error);
      if (requestId === giphyRequestId.current) {
        setGifError('Unable to load GIFs right now.');
        setGifResults([]);
      }
    } finally {
      if (requestId === giphyRequestId.current) {
        setGifLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (pickerTab !== 'gif') {
      return;
    }

    void searchGifs(gifQuery);
  }, [pickerTab, gifQuery, searchGifs]);

  const handleSend = () => {
    if (!text.trim()) return;
    onTypingChange?.(false);
    onSend?.({ text: text.trim(), replyTo });
    setText('');
    setPickerOpen(false);
    setAttachOpen(false);
    onCancelReply?.();
  };

  // ─── Voice notes ───
  const handleSendVoiceNote = useCallback((mediaUrl: string, durationSeconds: number) => {
    const mm = Math.floor(durationSeconds / 60);
    const ss = Math.floor(durationSeconds % 60);
    onSendRichMessage?.({
      text: `Voice note (${mm}:${String(ss).padStart(2, '0')})`,
      contentType: 'voice-note',
      mediaUrl,
      duration: `${mm}:${String(ss).padStart(2, '0')}`,
    });
    setVoiceMode(false);
  }, [onSendRichMessage]);

  // ─── Attachment callbacks ───
  const handleSendImage = (dataUrl: string) => {
    onSendRichMessage?.({
      text: 'Photo',
      contentType: 'image',
      mediaUrl: dataUrl,
      fileName: `photo_${Date.now()}.jpg`,
      fileType: 'image/jpeg',
    });
  };

  const handleSendCamera = (dataUrl: string) => {
    onSendRichMessage?.({
      text: 'Camera photo',
      contentType: 'image',
      mediaUrl: dataUrl,
      fileName: `camera_${Date.now()}.jpg`,
      fileType: 'image/jpeg',
    });
  };

  const handleSendDocument = (data: { fileName: string; fileSize: string; dataUrl: string; fileType?: string }) => {
    const isVideo = data.fileType?.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(data.fileName);
    onSendRichMessage?.({
      text: data.fileName,
      contentType: isVideo ? 'video' : 'file',
      mediaUrl: data.dataUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType || (isVideo ? 'video/mp4' : 'application/octet-stream'),
    });
  };
  const handleSendLocation = (data: { latitude: number; longitude: number; description: string }) => {
    onSendRichMessage?.({ text: data.description || 'Location', contentType: 'location', locationData: data });
  };
  const handleSendContact = (data: { name: string; uid: string }) => {
    onSendRichMessage?.({ text: data.name || 'Contact', contentType: 'contact', contactData: data });
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
    onSendRichMessage?.({ text: `Poll: ${data.question}`, contentType: 'poll', pollData });
  };
  const handleSendEvent = (data: { title: string; date: string; time: string; description?: string; location?: string }) => {
    onSendRichMessage?.({ text: data.title || 'Event', contentType: 'event', eventData: data });
  };

  const handleSelectGif = (gif: GiphyGifResult) => {
    onSendRichMessage?.({
      text: '',
      contentType: 'image',
      mediaUrl: gif.url,
      fileName: `${gif.title}.gif`,
      fileType: 'image/gif',
    });
    setPickerOpen(false);
    setAttachOpen(false);
  };

  // Dispatch files from FilePreviewModal
  const handleSendStagedFiles = async ({ files, caption, isViewOnce }: { files: File[]; caption: string; isViewOnce: boolean }) => {
    if (files.length === 0) return;
    const mediaGroupId = crypto.randomUUID();
    setStagedFiles([]);

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
      const isVoice = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);

      let contentType: ChatMessage['contentType'] = isImage ? 'image' : isVideo ? 'video' : isVoice ? 'voice-note' : 'file';
      if (isViewOnce && (isImage || isVideo)) {
        contentType = 'view-once';
      }

      onSendRichMessage?.({
        text: index === 0 && caption ? caption : file.name,
        contentType,
        mediaUrl: dataUrl,
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        fileType: file.type || 'application/octet-stream',
        mediaGroupId,
        isViewOnce,
      });
    }
  };

  return (
    <div className="input-bar-wrapper" style={{ position: 'relative' }}>
      {uploadProgress > 0 && (
        <div style={{ position: 'absolute', top: -56, right: 16, zIndex: 100, background: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 28 }}>
          <MediaProgressRing progress={uploadProgress} onCancel={() => setUploadProgress(0)} />
        </div>
      )}
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
                {tab === 'sticker' && <Sticker size={18} />}
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
              perLine={8}
              maxFrequentRows={1}
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
            <div className="gif-picker">
              <div className="gif-search-row">
                <input
                  className="gif-search-input"
                  type="text"
                  value={gifQuery}
                  onChange={(event) => setGifQuery(event.target.value)}
                  placeholder="Search GIFs"
                />
              </div>

              {gifLoading ? (
                <div className="gif-empty-state">Loading GIFs…</div>
              ) : gifError ? (
                <div className="gif-empty-state">{gifError}</div>
              ) : gifResults.length === 0 ? (
                <div className="gif-empty-state">No GIFs found. Try another search.</div>
              ) : (
                <div className="gif-grid">
                  {gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="gif-card"
                      onClick={() => handleSelectGif(gif)}
                      aria-label={`Send ${gif.title}`}
                    >
                      <img src={gif.preview} alt={gif.title} className="gif-thumb" />
                    </button>
                  ))}
                </div>
              )}
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
        onSelectFiles={(files) => setStagedFiles((prev) => [...prev, ...files])}
      />

      <input
        id="file-input"
        type="file"
        multiple
        accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) {
            setStagedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
            e.target.value = '';
          }
        }}
      />

      <FilePreviewModal
        isOpen={stagedFiles.length > 0}
        onClose={() => setStagedFiles([])}
        files={stagedFiles}
        onRemoveFile={(idx) => setStagedFiles((prev) => prev.filter((_, i) => i !== idx))}
        onAddFiles={(newFiles) => setStagedFiles((prev) => [...prev, ...newFiles])}
        onSend={handleSendStagedFiles}
      />

      <div className="input-row">
        {voiceMode ? (
          <VoiceRecorderBar
            onCancel={() => setVoiceMode(false)}
            onSend={handleSendVoiceNote}
          />
        ) : (
          <>
            <button className="input-icon-btn" onClick={() => { setPickerOpen((open) => !open); setAttachOpen(false); }} type="button">
              <Smile size={22} />
            </button>

            <div className="input-box">
              <textarea
                ref={textRef}
                value={text}
                onPaste={handlePaste}
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
                placeholder="Type a secure message (or paste files)..."
                rows={1}
                className="msg-textarea"
              />
            </div>

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
            ) : (
              <button
                className="send-btn active mic-btn"
                onClick={() => setVoiceMode(true)}
                type="button"
                title="Record voice note"
              >
                <Mic size={18} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default MessageInputBar;
