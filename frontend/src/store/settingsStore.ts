import { create } from 'zustand';

interface SettingsState {
  isDarkMode: boolean;
  messageNotifications: boolean;
  callNotifications: boolean;
  showOnlineStatus: boolean;
  readReceipts: boolean;
  
  setDarkMode: (value: boolean) => void;
  setMessageNotifications: (value: boolean) => void;
  setCallNotifications: (value: boolean) => void;
  setShowOnlineStatus: (value: boolean) => void;
  setReadReceipts: (value: boolean) => void;
}

const getStoredBool = (key: string, defaultValue: boolean): boolean => {
  const stored = localStorage.getItem(key);
  return stored !== null ? stored === 'true' : defaultValue;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  isDarkMode: getStoredBool('slienx_dark_mode', true),
  messageNotifications: getStoredBool('slienx_msg_notif', true),
  callNotifications: getStoredBool('slienx_call_notif', true),
  showOnlineStatus: getStoredBool('slienx_online_status', true),
  readReceipts: getStoredBool('slienx_read_receipts', true),

  setDarkMode: (value) => {
    localStorage.setItem('slienx_dark_mode', String(value));
    document.documentElement.setAttribute('data-theme', value ? 'dark' : 'light');
    set({ isDarkMode: value });
  },
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
}));
