import React, { useRef, useState } from 'react';
import { X, Check, Upload, Image as ImageIcon } from 'lucide-react';
import { useSettingsStore, WallpaperFit } from '../store/settingsStore';

// Built-in wallpapers – images are in /wallpapers/ (served from public/)
export const BUILTIN_WALLPAPERS = [
  {
    id: 'none',
    label: 'Default',
    value: null,
    preview: null, // renders as a theme-colored square
  },
  {
    id: 'purple_teal',
    label: 'Purple Teal',
    value: '/wallpapers/purple_teal.png',
    preview: '/wallpapers/purple_teal.png',
  },
  {
    id: 'pink_peach',
    label: 'Pink Peach',
    value: '/wallpapers/pink_peach.png',
    preview: '/wallpapers/pink_peach.png',
  },
  {
    id: 'dark_ocean',
    label: 'Dark Ocean',
    value: '/wallpapers/dark_ocean.png',
    preview: '/wallpapers/dark_ocean.png',
  },
  {
    id: 'forest_green',
    label: 'Forest Green',
    value: '/wallpapers/forest_green.png',
    preview: '/wallpapers/forest_green.png',
  },
  {
    id: 'sunset_warm',
    label: 'Sunset',
    value: '/wallpapers/sunset_warm.png',
    preview: '/wallpapers/sunset_warm.png',
  },
  {
    id: 'space_nebula',
    label: 'Space Nebula',
    value: '/wallpapers/space_nebula.png',
    preview: '/wallpapers/space_nebula.png',
  },
  // CSS gradient wallpapers (no image file needed)
  {
    id: 'gradient_indigo',
    label: 'Indigo Dusk',
    value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
    preview: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
  },
  {
    id: 'gradient_rose',
    label: 'Rose Gold',
    value: 'linear-gradient(135deg, #4a1942 0%, #9d174d 50%, #f472b6 100%)',
    preview: 'linear-gradient(135deg, #4a1942 0%, #9d174d 50%, #f472b6 100%)',
  },
  {
    id: 'gradient_mint',
    label: 'Mint Fresh',
    value: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)',
    preview: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)',
  },
  {
    id: 'gradient_amber',
    label: 'Amber Glow',
    value: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)',
    preview: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)',
  },
  {
    id: 'gradient_slate',
    label: 'Slate Storm',
    value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    preview: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
  },
];

interface WallpaperPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const WallpaperPicker: React.FC<WallpaperPickerProps> = ({ isOpen, onClose }) => {
  const {
    chatWallpaper,
    setChatWallpaper,
    chatWallpaperFit,
    setChatWallpaperFit,
    chatWallpaperDim,
    setChatWallpaperDim,
  } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewCustom, setPreviewCustom] = useState<string | null>(null);

  if (!isOpen) return null;

  const isGradient = (val: string | null) => val?.startsWith('linear-gradient') || val?.startsWith('radial-gradient');

  const getCurrentId = () => {
    if (!chatWallpaper) return 'none';
    const match = BUILTIN_WALLPAPERS.find((w) => w.value === chatWallpaper);
    return match ? match.id : 'custom';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewCustom(dataUrl);
      setChatWallpaper(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const currentId = getCurrentId();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          width: 'min(540px, 94vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Chat Wallpaper
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Choose background and adjust display ratio for your chat
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Preview Strip */}
        <div
          style={{
            flexShrink: 0,
            height: '130px',
            position: 'relative',
            overflow: 'hidden',
            borderBottom: '1px solid var(--border-color)',
            ...(chatWallpaper && isGradient(chatWallpaper)
              ? { background: chatWallpaper }
              : chatWallpaper
              ? {
                  backgroundImage: `url(${chatWallpaper})`,
                  backgroundSize: chatWallpaperFit === 'tile' ? 'auto' : chatWallpaperFit,
                  backgroundRepeat: chatWallpaperFit === 'tile' ? 'repeat' : 'no-repeat',
                  backgroundPosition: 'center',
                }
              : { background: 'var(--bg-primary)' }),
          }}
        >
          {chatWallpaper && chatWallpaperDim > 0 && (
            <div style={{ position: 'absolute', inset: 0, background: `rgba(0, 0, 0, ${chatWallpaperDim})`, pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 }}>
            <div style={{ background: 'rgba(var(--color-accent-rgb), 0.9)', borderRadius: '18px 18px 4px 18px', padding: '8px 14px', maxWidth: '55%', fontSize: 12, color: '#fff', fontWeight: 500, backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              Hey! Preview looks 🔥
            </div>
            <div style={{ background: 'rgba(30,30,40,0.75)', borderRadius: '18px 18px 18px 4px', padding: '8px 14px', maxWidth: '55%', fontSize: 12, color: '#fff', fontWeight: 500, backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', alignSelf: 'flex-end' }}>
              Yeah, looks great! 😍
            </div>
          </div>
          {!chatWallpaper && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}>
              <ImageIcon size={16} style={{ marginRight: 6 }} /> Default theme background
            </div>
          )}
        </div>

        {/* Grid of wallpapers */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 20px', flex: 1 }}>
          {/* Custom Upload */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Custom
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                border: currentId === 'custom' ? '2px solid var(--color-primary)' : '2px dashed var(--border-color)',
                borderRadius: 12,
                background: currentId === 'custom' ? 'rgba(var(--color-accent-rgb), 0.06)' : 'transparent',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              {previewCustom || currentId === 'custom' ? (
                <img
                  src={previewCustom || chatWallpaper || ''}
                  alt="Custom wallpaper"
                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Upload size={18} color="var(--text-secondary)" />
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Upload Image</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>JPG, PNG, WebP · Max 5MB</div>
              </div>
              {currentId === 'custom' && <Check size={16} style={{ marginLeft: 'auto', color: 'var(--color-primary)' }} />}
            </button>
          </div>

          {/* Fit Mode & Dimming Controls */}
          {chatWallpaper && !isGradient(chatWallpaper) && (
            <div style={{ marginBottom: 16, background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Wallpaper Fit / Ratio
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {chatWallpaperFit.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'cover', label: 'Cover (Fill)' },
                  { id: 'contain', label: 'Contain' },
                  { id: 'center', label: 'Center' },
                  { id: 'tile', label: 'Tile' },
                ].map((fitOpt) => (
                  <button
                    key={fitOpt.id}
                    type="button"
                    onClick={() => setChatWallpaperFit(fitOpt.id as WallpaperFit)}
                    style={{
                      padding: '6px 4px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: chatWallpaperFit === fitOpt.id ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      background: chatWallpaperFit === fitOpt.id ? 'rgba(var(--color-accent-rgb), 0.12)' : 'var(--bg-primary)',
                      color: chatWallpaperFit === fitOpt.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {fitOpt.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Wallpaper Dimming
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {Math.round(chatWallpaperDim * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.6"
                step="0.05"
                value={chatWallpaperDim}
                onChange={(e) => setChatWallpaperDim(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>
          )}

          {/* Built-in wallpapers */}
          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Built-in Wallpapers
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {BUILTIN_WALLPAPERS.map((wp) => {
              const isActive = currentId === wp.id;
              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => setChatWallpaper(wp.value)}
                  title={wp.label}
                  style={{
                    position: 'relative',
                    border: isActive ? '2.5px solid var(--color-primary)' : '2px solid var(--border-color)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    aspectRatio: '9/16',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    boxShadow: isActive ? '0 0 0 3px rgba(var(--color-accent-rgb),0.3)' : 'none',
                    ...(wp.preview && !isGradient(wp.preview)
                      ? { backgroundImage: `url(${wp.preview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : wp.preview
                      ? { background: wp.preview }
                      : { background: 'var(--bg-secondary)' }),
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.25)',
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} color="#fff" />
                      </div>
                    </div>
                  )}
                  {wp.id === 'none' && !wp.preview && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      None
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '4px 6px',
                    background: 'rgba(0,0,0,0.45)',
                    fontSize: 9,
                    fontWeight: 600,
                    color: '#fff',
                    textAlign: 'center',
                    letterSpacing: '0.03em',
                  }}>
                    {wp.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => { setChatWallpaper(null); setPreviewCustom(null); setChatWallpaperDim(0); setChatWallpaperFit('cover'); }}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default WallpaperPicker;
