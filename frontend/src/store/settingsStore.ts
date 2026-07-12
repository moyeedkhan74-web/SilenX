import { create } from 'zustand';

interface SettingsState {
  messageNotifications: boolean;
  callNotifications: boolean;
  showOnlineStatus: boolean;
  readReceipts: boolean;
  
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
  messageNotifications: getStoredBool('slienx_msg_notif', true),
  callNotifications: getStoredBool('slienx_call_notif', true),
  showOnlineStatus: getStoredBool('slienx_online_status', true),
  readReceipts: getStoredBool('slienx_read_receipts', true),

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
