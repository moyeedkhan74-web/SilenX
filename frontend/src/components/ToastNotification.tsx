import React, { useEffect } from 'react';

interface ToastNotificationProps {
  message: string;
  visible: boolean;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, visible, onClose }) => {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(onClose, 1800);
    return () => window.clearTimeout(timer);
  }, [visible, onClose]);

  if (!visible) return null;

  return <div className="toast-notification" role="status">{message}</div>;
};

export default ToastNotification;
