import { useEffect, useRef, useState } from 'react';

interface ActiveCallScreenProps {
  callerName: string;
  callerAvatarUrl?: string;
  callType: 'audio' | 'video';
  isMuted: boolean;
  isCameraOff: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function ActiveCallScreen({
  callerName,
  callerAvatarUrl,
  callType,
  isMuted,
  isCameraOff,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleCamera,
  onEndCall,
}: ActiveCallScreenProps) {
  const [seconds, setSeconds] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const initial = callerName?.charAt(0)?.toUpperCase() || '?';

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.volume = speakerOn ? 1 : 0.6;
    }
  }, [remoteStream, speakerOn]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.volume = speakerOn ? 1 : 0.6;
    }
  }, [remoteStream, speakerOn]);

  const showRemoteVideo = callType === 'video' && remoteStream;

  return (
    <div className="active-call">
      <div className="active-call__backdrop" />

      {showRemoteVideo ? (
        <video ref={remoteVideoRef} className="active-call__remote-video" autoPlay playsInline />
      ) : (
        <div className="active-call__center">
          {callerAvatarUrl ? (
            <img src={callerAvatarUrl} alt={callerName} className="active-call__avatar-img" />
          ) : (
            <div className="active-call__avatar-fallback">{initial}</div>
          )}
        </div>
      )}

      {callType === 'video' && localStream && !isCameraOff && (
        <video ref={localVideoRef} className="active-call__local-video" autoPlay playsInline muted />
      )}

      {callType === 'audio' && (
        <audio ref={remoteAudioRef} autoPlay />
      )}

      <div className="active-call__top">
        <h2 className="active-call__name">{callerName}</h2>
        <div className="active-call__meta">
          <span className="active-call__e2ee">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H9V6a3 3 0 013-3z" />
            </svg>
            End-to-end encrypted
          </span>
          <span className="active-call__dot" />
          <span className="active-call__timer">{formatDuration(seconds)}</span>
        </div>
      </div>

      <div className="active-call__controls">
        <button
          type="button"
          className={`ctrl-btn ${isMuted ? 'ctrl-btn--active' : ''}`}
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l22 22" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6" />
              <path d="M17 16.95A7 7 0 015 12v-2M19 10v2a7 7 0 01-.11 1.23" />
              <path d="M12 19v3" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0014 0v-2" />
              <path d="M12 19v3" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`ctrl-btn ${speakerOn ? 'ctrl-btn--active' : ''}`}
          onClick={() => setSpeakerOn((value) => !value)}
          aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}
          title={speakerOn ? 'Speaker on' : 'Speaker off'}
        >
          {speakerOn ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 9h4l5-5v16l-5-5H5z" />
              <path d="M15 8c1.5 1.5 1.5 3.5 0 5" />
              <path d="M18 5c3 3 3 7 0 10" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 9h4l5-5v16l-5-5H5z" />
              <path d="M19 5l-14 14" />
            </svg>
          )}
        </button>

        {callType === 'video' && (
          <button
            type="button"
            className={`ctrl-btn ${isCameraOff ? 'ctrl-btn--active' : ''}`}
            onClick={onToggleCamera}
            aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isCameraOff ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l22 22" />
                <path d="M21 7l-5 4v-4a2 2 0 00-2-2H8" />
                <path d="M3 7v10a2 2 0 002 2h9" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            )}
          </button>
        )}

        <button
          type="button"
          className="ctrl-btn ctrl-btn--end"
          onClick={onEndCall}
          aria-label="End call"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.87-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.1c-.18-.18-.29-.43-.29-.71 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.68c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.75-1.68-1.38-2.66-1.87-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" transform="rotate(135 12 12)" />
          </svg>
        </button>
      </div>

      <style>{`
        .active-call {
          position: relative;
          width: 100%;
          min-height: 100vh;
          overflow: hidden;
          background: var(--color-bg);
          display: flex;
          flex-direction: column;
        }

        .active-call__backdrop {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 25%,
            rgba(var(--color-accent-rgb), 0.18) 0%, transparent 60%),
            linear-gradient(160deg, var(--color-primary-dark) 0%, var(--color-bg) 100%);
        }

        .active-call__remote-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .active-call__center {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .active-call__avatar-img,
        .active-call__avatar-fallback {
          width: 128px;
          height: 128px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 0 0 1px var(--color-accent),
            0 0 40px rgba(var(--color-accent-rgb), 0.3);
        }

        .active-call__avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 500;
          color: #fff;
          background: var(--color-accent);
        }

        .active-call__local-video {
          position: absolute;
          z-index: 2;
          top: 20px;
          right: 20px;
          width: 110px;
          height: 150px;
          border-radius: 12px;
          object-fit: cover;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .active-call__top {
          position: relative;
          z-index: 1;
          text-align: center;
          padding-top: 56px;
        }

        .active-call__name {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 500;
          color: #fff;
        }

        .active-call__meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.75);
        }

        .active-call__e2ee {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--color-accent);
        }

        .active-call__dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.45);
        }

        .active-call__timer {
          font-variant-numeric: tabular-nums;
        }

        .active-call__controls {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 32px 0 48px;
        }

        .ctrl-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #fff;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .ctrl-btn:hover {
          background: rgba(255,255,255,0.16);
        }

        .ctrl-btn:active {
          transform: scale(0.92);
        }

        .ctrl-btn--active {
          background: #fff;
          color: #111;
        }

        .ctrl-btn--end {
          background: var(--danger-main);
          width: 64px;
        }

        .ctrl-btn--end:hover {
          opacity: 0.92;
        }
      `}</style>
    </div>
  );
}
