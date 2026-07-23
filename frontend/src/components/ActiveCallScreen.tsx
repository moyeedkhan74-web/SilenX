import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import { Avatar } from './Avatar';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [audioOutputSupported, setAudioOutputSupported] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Timer ticker
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Audio output API support check
  useEffect(() => {
    setAudioOutputSupported(
      typeof HTMLMediaElement !== 'undefined' &&
        typeof HTMLMediaElement.prototype.setSinkId === 'function'
    );
  }, []);

  // Local video stream binding
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Remote video stream binding
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.volume = speakerOn ? 1 : 0.6;
      remoteVideoRef.current
        .play()
        .catch((error) => console.warn('[ActiveCallScreen] remote video autoplay blocked', error));
    }
  }, [remoteStream, speakerOn]);

  // Remote audio stream binding
  useEffect(() => {
    const element = callType === 'audio' ? remoteAudioRef.current : remoteVideoRef.current;
    if (!element || !remoteStream) return;

    element.srcObject = remoteStream;
    element.volume = speakerOn ? 1 : 0.6;

    const setSink = async () => {
      if (!audioOutputSupported || typeof element.setSinkId !== 'function') return;
      try {
        const outputId = speakerOn ? 'default' : 'communications';
        await element.setSinkId(outputId);
      } catch (error) {
        console.warn('[ActiveCallScreen] setSinkId failed', error);
      }
    };

    setSink();
    element
      .play()
      .then(() => setAudioPlaybackBlocked(false))
      .catch((error) => {
        console.warn('[ActiveCallScreen] remote audio autoplay blocked', error);
        setAudioPlaybackBlocked(true);
      });
  }, [callType, remoteStream, speakerOn, audioOutputSupported]);

  const enableAudioPlayback = async () => {
    if (remoteAudioRef.current) {
      try {
        await remoteAudioRef.current.play();
        setAudioPlaybackBlocked(false);
      } catch (error) {
        console.warn('[ActiveCallScreen] enableAudioPlayback failed', error);
      }
    }
  };

  const toggleSpeaker = async () => {
    const nextSpeakerOn = !speakerOn;
    setSpeakerOn(nextSpeakerOn);

    const element = callType === 'audio' ? remoteAudioRef.current : remoteVideoRef.current;
    if (element) {
      element.volume = nextSpeakerOn ? 1 : 0.2;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => null);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => null);
    }
  };

  const isVideo = callType === 'video';
  const showRemoteVideo = isVideo && remoteStream;

  return (
    <div ref={containerRef} className={`active-call ${isFullscreen ? 'active-call--fullscreen' : ''}`}>
      <div className="active-call__backdrop" />

      {/* Main Stream / Center View */}
      {showRemoteVideo ? (
        <video ref={remoteVideoRef} className="active-call__remote-video" autoPlay playsInline />
      ) : (
        <div className="active-call__center">
          <div className="active-call__avatar-pulse">
            <Avatar name={callerName} size={128} avatarUrl={callerAvatarUrl} />
          </div>
        </div>
      )}

      {/* Floating Local Picture-In-Picture Video */}
      {isVideo && localStream && (
        <div className="active-call__pip-wrapper">
          {isCameraOff ? (
            <div className="active-call__local-pip active-call__local-pip--off">
              <VideoOff size={24} className="pip-off-icon" />
              <span>Camera Off</span>
            </div>
          ) : (
            <video ref={localVideoRef} className="active-call__local-pip" autoPlay playsInline muted />
          )}
        </div>
      )}

      {/* Hidden / Explicit Remote Audio Element for Audio-Only Calls */}
      {callType === 'audio' && (
        <>
          <audio ref={remoteAudioRef} autoPlay />
          {audioPlaybackBlocked && (
            <div className="active-call__audio-fallback">
              <button type="button" className="audio-fallback-button" onClick={enableAudioPlayback}>
                🔊 Tap to Unmute Remote Audio
              </button>
            </div>
          )}
        </>
      )}

      {/* Top Bar Info */}
      <div className="active-call__top">
        <h2 className="active-call__name">{callerName}</h2>
        <div className="active-call__meta">
          <span className="active-call__e2ee">
            🔒 End-to-end encrypted
          </span>
          <span className="active-call__dot" />
          <span className="active-call__timer">{formatDuration(seconds)}</span>
        </div>
      </div>

      {/* Floating Control Bar */}
      <div className="active-call__controls">
        {/* Mute Button */}
        <div className="ctrl-btn-wrapper">
          <button
            type="button"
            className={`ctrl-btn ${isMuted ? 'ctrl-btn--muted' : 'ctrl-btn--on'}`}
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <span className="ctrl-btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>

        {/* Speaker Button */}
        <div className="ctrl-btn-wrapper">
          <button
            type="button"
            className={`ctrl-btn ${speakerOn ? 'ctrl-btn--on' : 'ctrl-btn--muted'}`}
            onClick={toggleSpeaker}
            aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}
            title={speakerOn ? 'Speaker On' : 'Speaker Off'}
          >
            {speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          <span className="ctrl-btn-label">{speakerOn ? 'Speaker' : 'Muted'}</span>
        </div>

        {/* Camera Toggle Button (Video Calls Only) */}
        {isVideo && (
          <div className="ctrl-btn-wrapper">
            <button
              type="button"
              className={`ctrl-btn ${isCameraOff ? 'ctrl-btn--camera-off' : 'ctrl-btn--on'}`}
              onClick={onToggleCamera}
              aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
            <span className="ctrl-btn-label">{isCameraOff ? 'Cam Off' : 'Cam On'}</span>
          </div>
        )}

        {/* Fullscreen Toggle Button */}
        <div className="ctrl-btn-wrapper">
          <button
            type="button"
            className="ctrl-btn ctrl-btn--on"
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <span className="ctrl-btn-label">{isFullscreen ? 'Exit' : 'Full'}</span>
        </div>

        {/* End Call Button */}
        <div className="ctrl-btn-wrapper">
          <button
            type="button"
            className="ctrl-btn ctrl-btn--end"
            onClick={onEndCall}
            aria-label="End call"
            title="End Call"
          >
            <PhoneOff size={24} />
          </button>
          <span className="ctrl-btn-label ctrl-btn-label--end">End</span>
        </div>
      </div>

      <style>{`
        .active-call {
          position: relative;
          width: 100%;
          height: 100vh;
          min-height: 100vh;
          overflow: hidden;
          background: #090d16;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 32px 20px 40px;
          user-select: none;
        }

        .active-call--fullscreen {
          position: fixed;
          inset: 0;
          z-index: 9999;
        }

        .active-call__backdrop {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 30%, rgba(var(--color-accent-rgb), 0.22) 0%, transparent 65%),
            linear-gradient(180deg, rgba(13, 17, 26, 0.95) 0%, #080c14 100%);
          pointer-events: none;
        }

        .active-call__remote-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .active-call__center {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .active-call__avatar-pulse {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .active-call__avatar-pulse::before {
          content: '';
          position: absolute;
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background: rgba(var(--color-accent-rgb), 0.2);
          animation: avatarGlowPulse 2.8s ease-in-out infinite;
        }

        .active-call__pip-wrapper {
          position: absolute;
          z-index: 10;
          top: 24px;
          right: 24px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
        }

        .active-call__local-pip {
          width: 120px;
          height: 165px;
          border-radius: 20px;
          object-fit: cover;
          border: 2px solid rgba(255, 255, 255, 0.2);
          background: #111827;
          transform: scaleX(-1);
          transition: all 0.3s ease;
        }

        .active-call__local-pip--off {
          transform: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.75rem;
          font-weight: 500;
          background: rgba(17, 24, 39, 0.9);
          backdrop-filter: blur(12px);
        }

        .pip-off-icon {
          color: #ef4444;
        }

        /* Top Header */
        .active-call__top {
          position: relative;
          z-index: 2;
          text-align: center;
          margin-top: 12px;
        }

        .active-call__name {
          margin: 0 0 6px;
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }

        .active-call__meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 0.88rem;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(0, 0, 0, 0.35);
          padding: 6px 16px;
          border-radius: 999px;
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .active-call__e2ee {
          color: #34d399;
          font-weight: 500;
        }

        .active-call__dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
        }

        .active-call__timer {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          color: #ffffff;
        }

        /* Bottom Controls Bar */
        .active-call__controls {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          background: rgba(18, 24, 38, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 16px 28px;
          border-radius: 999px;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        .ctrl-btn-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .ctrl-btn {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ffffff;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .ctrl-btn:hover {
          transform: scale(1.08);
        }

        .ctrl-btn:active {
          transform: scale(0.92);
        }

        .ctrl-btn--on {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }

        .ctrl-btn--on:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .ctrl-btn--muted,
        .ctrl-btn--camera-off {
          background: #ef4444;
          color: #ffffff;
          box-shadow: 0 6px 18px rgba(239, 68, 68, 0.45);
        }

        .ctrl-btn--end {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          width: 58px;
          height: 58px;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.5);
        }

        .ctrl-btn--end:hover {
          box-shadow: 0 12px 30px rgba(239, 68, 68, 0.7);
        }

        .ctrl-btn-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.75);
        }

        .ctrl-btn-label--end {
          color: #f87171;
          font-weight: 600;
        }

        .active-call__audio-fallback {
          position: absolute;
          bottom: 120px;
          z-index: 10;
        }

        .audio-fallback-button {
          color: #ffffff;
          background: rgba(239, 68, 68, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 999px;
          padding: 10px 20px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }

        @keyframes avatarGlowPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }

        @media (max-width: 480px) {
          .active-call {
            padding: 24px 12px 28px;
          }
          .active-call__controls {
            gap: 12px;
            padding: 12px 18px;
          }
          .ctrl-btn {
            width: 46px;
            height: 46px;
          }
          .ctrl-btn--end {
            width: 52px;
            height: 52px;
          }
          .active-call__local-pip {
            width: 95px;
            height: 135px;
          }
        }
      `}</style>
    </div>
  );
}
