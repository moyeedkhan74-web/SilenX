/** @jsxImportSource react */
// src/components/PreviewScreen.tsx
// Screen for previewing selected photos before sending
// Shows thumbnails, remove button, caption input, and Send button

import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { makeThumbnail, blobToDataUrl } from '../utils/imageUtils';

export interface PreviewScreenProps {
  visible: boolean;
  onClose: () => void;
  onSend: (items: File[], captions: string[]) => void;
  files: File[];
}

interface PreviewItem {
  id: string;
  file: File;
  thumbnail: string;
  original: string;
  width: number;
  height: number;
  caption: string;
}

export const PreviewScreen = ({
  visible,
  onClose,
  onSend,
  files,
}: PreviewScreenProps) => {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || files.length === 0) return;

    const generatePreviews = async () => {
      const newItems = await Promise.all(
        files.map(async (file) => {
          const original = URL.createObjectURL(file);
          const thumb = await makeThumbnail(file);
          const originalThumb = thumb.blob;
          const thumbnail = await blobToDataUrl(originalThumb);

          // Get dimensions
          const img = new Image();
          const dims = await new Promise<{ width: number; height: number }>(
            (resolve) => {
              img.onload = () => {
                resolve({ width: img.width, height: img.height });
              };
              img.src = original;
            }
          );

          return {
            id: crypto.randomUUID(),
            file,
            thumbnail,
            original,
            width: dims.width,
            height: dims.height,
            caption: '',
          };
        })
      );
      setItems(newItems);
    };

    generatePreviews();

    return () => {
      // Cleanup object URLs
      items.forEach((item) => URL.revokeObjectURL(item.original));
    };
  }, [visible, files]);

  const handleSend = () => {
    if (items.length === 0) return;

    setSending(true);
    const fileItems = items.map((item) => item.file);
    const captions = items.map((item) => item.caption);

    onSend(fileItems, captions);
    setSending(false);
    onClose();
  };

  const handleRemove = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      URL.revokeObjectURL(item.original);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateCaption = (id: string, caption: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, caption } : item
      )
    );
  };

  if (!visible) return null;

  return (
    <div className="preview-screen-backdrop">
      <div className="preview-screen">
        <div className="preview-header">
          <button type="button" onClick={onClose} className="preview-close-btn">
            <X size={24} />
          </button>
          <h2 className="preview-title">Preview</h2>
          <div style={{ width: 24 }} />
        </div>

        <div className="preview-images">
          {items.map((item) => (
            <div key={item.id} className="preview-item">
              <img
                src={item.thumbnail}
                alt="preview"
                className="preview-image"
              />
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="preview-remove-btn"
                aria-label="Remove"
              >
                <X size={16} />
              </button>
              <input
                type="text"
                placeholder="Add a caption..."
                value={item.caption}
                onChange={(e) => updateCaption(item.id, e.target.value)}
                className="preview-caption-input"
              />
            </div>
          ))}
        </div>

        <div className="preview-footer">
          <button type="button" onClick={onClose} className="preview-cancel-btn">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || items.length === 0}
            className="preview-send-btn"
          >
            <Send size={18} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
