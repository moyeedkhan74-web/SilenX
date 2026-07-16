// Export all UI components
export { PinButton } from './PinButton';
export { MicButton } from './MicButton';
export { MessageWithPin, ChatInput, ChatComponent } from './ChatExample';

// Types
export interface PinButtonProps {
  messageId: string;
  isPinned: boolean;
  onPin: (messageId: string) => Promise<void>;
  onUnpin: (messageId: string) => Promise<void>;
  loading?: boolean;
}

export interface MicButtonProps {
  onRecordingStart?: () => void;
  onRecordingStop?: (filePath: string, duration: number) => Promise<void>;
  onRecordingCancel?: () => void;
  disabled?: boolean;
}
