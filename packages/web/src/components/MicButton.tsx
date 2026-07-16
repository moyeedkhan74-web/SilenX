import React, { useState, useRef, useEffect } from 'react';
import './MicButton.css';

interface MicButtonProps {
  onRecordingStart?: () => void;
  onRecordingStop?: (filePath: string, duration: number) => Promise<void>;
  onRecordingCancel?: () => void;
  disabled?: boolean;
}

/**
 * MIC BUTTON - Like WhatsApp & Telegram
 * Press to record voice note
 * Shows timer while recording
 * Swipe left to cancel (mobile)
 */
export const MicButton: React.FC<MicButtonProps> = ({
  onRecordingStart,
  onRecordingStop,
  onRecordingCancel,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const recordingStateRef = useRef({
    filePath: '',
    isRecording: false,
  });

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleMouseDown = async () => {
    if (disabled) return;
    setIsRecording(true);
    onRecordingStart?.();
  };

  const handleMouseUp = async () => {
    if (!isRecording) return;
    setIsRecording(false);

    if (onRecordingStop) {
      try {
        await onRecordingStop(recordingStateRef.current.filePath, duration);
      } catch (error) {
        console.error('Recording error:', error);
      }
    }
  };

  const handleCancel = () => {
    setIsRecording(false);
    setIsLocked(false);
    onRecordingCancel?.();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mic-container">
      <button
        className={`mic-btn ${isRecording ? 'recording' : ''} ${isLocked ? 'locked' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={isLocked ? undefined : handleMouseUp}
        onDoubleClick={() => setIsLocked(!isLocked)}
        disabled={disabled}
        title="Press to record voice note"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 16.91c-1.48 1.46-3.5 2.36-5.77 2.36-2.27 0-4.29-.9-5.77-2.36M19 9h2c0 5.25-4.24 9.67-9.5 9.97V23h-3v-4.03C7.24 18.67 3 14.25 3 9H5c0 4.41 3.59 8 8 8s8-3.59 8-8z" />
        </svg>
      </button>

      {isRecording && (
        <div className="recording-indicator">
          <span className="recording-dot"></span>
          <span className="recording-time">{formatTime(duration)}</span>
          {!isLocked && <span className="recording-hint">Release to send</span>}
          {isLocked && (
            <button className="cancel-btn" onClick={handleCancel}>
              ✕ Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MicButton;
