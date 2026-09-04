import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Send, Smile, X, Paperclip, Mic } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { AttachmentMenu } from './AttachmentMenu';
import { API_URL } from '../config/webrtc-config';
import VoiceRecorderBar from './VoiceRecorderBar';
import { MediaProgressRing } from './MediaProgressRing';
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
  const [uploadProgress, setUploadProgress] = useState<number>(0); // used for upload progress tracking in pending_sync state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
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

  // ─── Voice notes (full recorder UI lives in VoiceRecorderBar) ───
  const handleSendVoiceNote = useCallback((mediaUrl: string, durationSeconds: number) => {
    const mm = Math.floor(durationSeconds / 60);
    const ss = Math.floor(durationSeconds % 60);
    onSendRichMessage?.({
      text: `🎤 Voice note (${mm}:${String(ss).padStart(2, '0')})`,
      contentType: 'voice-note',
      mediaUrl,
      duration: `${mm}:${String(ss).padStart(2, '0')}`,
    });
    setVoiceMode(false);
  }, [onSendRichMessage]);

  // ─── Upload progress ───
  const uploadWithProgress = (file: Blob | string, url: string, onProgress: (pct: number) => void, onComplete: (msgId: string) => void) => {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        resolve(new Response(xhr.response, { status: xhr.status }));
        onComplete?.(crypto.randomUUID());
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
  };

  // ─── Attachment callbacks ───
  const handleSendImage = (dataUrl: string) => {
    uploadWithProgress(
      dataUrl,
      `${API_URL}/api/messages/image`,
      (pct) => setUploadProgress(pct),
      () => {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 500);
      }
    );
  };
  const handleSendCamera = (dataUrl: string) => {
    uploadWithProgress(
      dataUrl,
      `${API_URL}/api/messages/image`,
      (pct) => setUploadProgress(pct),
      () => {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 500);
      }
    );
  };
  const handleSendDocument = (data: { fileName: string; fileSize: string; dataUrl: string; fileType?: string }) => {
    uploadWithProgress(
      data.dataUrl,
      `${API_URL}/api/messages/document`,
      (pct) => setUploadProgress(pct),
      () => {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 500);
      }
    );
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

  // ─── Multi-select file browsing ───
  const handleFileSelect = (files: FileList) => {
    const newFiles = Array.from(files).slice(0, 10); // cap batch size to 10
    setSelectedFiles((prev) => {
      // Combine with existing, dedupe by name
      const combined = [...prev, ...newFiles];
      const deduped = combined.filter(
        (file, index) => combined.findIndex((f) => f.name === file.name) === index
      );
      setCaption(''); // reset caption on new selection
      return deduped.slice(0, 10);
    });
  };

  const sendBatch = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    const mediaGroupId = crypto.randomUUID();
    const batchCaption = caption.trim();

    // Send each file with the same mediaGroupId and optional caption on first item
    for (let index = 0; index < selectedFiles.length; index++) {
      const file = selectedFiles[index];
      const fileReader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve) => {
        fileReader.onloadend = () => resolve(fileReader.result as string);
        fileReader.readAsDataURL(file);
      });

      const dataUrl = await dataUrlPromise;

      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
      const validContentType: ChatMessage['contentType'] = isImage ? 'image' : isVideo ? 'video' : 'file';
      const mimeType = file.type || (isImage ? 'image/jpeg' : isVideo ? 'video/mp4' : 'application/octet-stream');

      onSendRichMessage?.({
        text: index === 0 && batchCaption ? batchCaption : file.name,
        contentType: validContentType,
        mediaUrl: dataUrl,
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        fileType: mimeType,
        mediaGroupId,
      });
    }

    setSelectedFiles([]);
    setCaption('');
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
      />

      <input
        id="file-input"
        type="file"
        multiple
        accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files as FileList)}
      />

      {selectedFiles.length > 0 && (
        <div className="media-preview-panel">
          <div className="media-preview-grid">
            {selectedFiles.map((f, i) => (
              <img
                key={i}
                src={URL.createObjectURL(f)}
                className="media-preview-thumb"
                alt={f.name}
              />
            ))}
          </div>
          <div className="media-preview-caption">
            <input
              type="text"
              placeholder="Add a caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="media-caption-input"
            />
          </div>
          <button onClick={sendBatch}>Send {selectedFiles.length}</button>
        </div>
      )}

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

            <button
              className="input-icon-btn attach-btn"
              onClick={() => { setAttachOpen((o) => !o); setPickerOpen(false); }}
              type="button"
              title="Attach"
            >
              <Paperclip size={22} />
            </button>

            {selectedFiles.length > 0 && (
              <div className="selected-files-badge">
                {selectedFiles.length} selected
              </div>
            )}

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
