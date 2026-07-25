import { create } from 'zustand';

export type WallpaperFit = 'cover' | 'contain' | 'tile' | 'center';

interface SettingsState {
  messageNotifications: boolean;
  callNotifications: boolean;
  showOnlineStatus: boolean;
  readReceipts: boolean;
  chatWallpaper: string | null; // null = default (no wallpaper), string = url or css gradient
  chatWallpaperFit: WallpaperFit;
  chatWallpaperDim: number; // 0 to 0.7

  setMessageNotifications: (value: boolean) => void;
  setCallNotifications: (value: boolean) => void;
  setShowOnlineStatus: (value: boolean) => void;
  setReadReceipts: (value: boolean) => void;
  setChatWallpaper: (value: string | null) => void;
  setChatWallpaperFit: (value: WallpaperFit) => void;
  setChatWallpaperDim: (value: number) => void;
}

const getStoredBool = (key: string, defaultValue: boolean): boolean => {
  const stored = localStorage.getItem(key);
  return stored !== null ? stored === 'true' : defaultValue;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  messageNotifications: getStoredBool('slienx_msg_notif', true),
  callNotifications: getStoredBool('slienx_call_notif', true),
  showOnlineStatus: getStoredBool('slienx_online_status', true),
  readReceipts: getStoredBool('slienx_read_receipts', true),
  chatWallpaper: localStorage.getItem('slienx_chat_wallpaper') || null,
  chatWallpaperFit: (localStorage.getItem('slienx_chat_wallpaper_fit') as WallpaperFit) || 'cover',
  chatWallpaperDim: Number(localStorage.getItem('slienx_chat_wallpaper_dim')) || 0,

  setMessageNotifications: (value) => {
    localStorage.setItem('slienx_msg_notif', String(value));
    set({ messageNotifications: value });
  },
  setCallNotifications: (value) => {
    localStorage.setItem('slienx_call_notif', String(value));
    set({ callNotifications: value });
  },
  setShowOnlineStatus: (value) => {
    localStorage.setItem('slienx_online_status', String(value));
    set({ showOnlineStatus: value });
  },
  setReadReceipts: (value) => {
    localStorage.setItem('slienx_read_receipts', String(value));
    set({ readReceipts: value });
  },
  setChatWallpaper: (value) => {
    if (value === null) {
      localStorage.removeItem('slienx_chat_wallpaper');
    } else {
      localStorage.setItem('slienx_chat_wallpaper', value);
    }
    set({ chatWallpaper: value });
  },
  setChatWallpaperFit: (value) => {
    localStorage.setItem('slienx_chat_wallpaper_fit', value);
    set({ chatWallpaperFit: value });
  },
  setChatWallpaperDim: (value) => {
    localStorage.setItem('slienx_chat_wallpaper_dim', String(value));
    set({ chatWallpaperDim: value });
  },
}));

