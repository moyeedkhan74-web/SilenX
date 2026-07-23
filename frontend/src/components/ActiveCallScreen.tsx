import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';

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
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [audioOutputSupported, setAudioOutputSupported] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const initial = callerName?.charAt(0)?.toUpperCase() || '?';

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setAudioOutputSupported(
      typeof HTMLMediaElement !== 'undefined' &&
        typeof HTMLMediaElement.prototype.setSinkId === 'function'
    );
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
      remoteVideoRef.current
        .play()
        .catch((error) => console.warn('[ActiveCallScreen] remote video autoplay blocked', error));
    }
  }, [remoteStream, speakerOn]);

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
        console.debug('[ActiveCallScreen] audio output set to', outputId);
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
    if (!audioOutputSupported) {
      return;
    }

    const element = callType === 'audio' ? remoteAudioRef.current : remoteVideoRef.current;
    if (!element || typeof element.setSinkId !== 'function') {
      return;
    }

    const nextSpeakerOn = !speakerOn;
    try {
      const outputId = nextSpeakerOn ? 'default' : 'communications';
      await element.setSinkId(outputId);
      console.debug('[ActiveCallScreen] speaker toggled to', outputId);
      setSpeakerOn(nextSpeakerOn);
    } catch (error) {
      console.warn('[ActiveCallScreen] speaker toggle failed', error);
    }
  };

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

      {callType === 'video' && localStream && (
        isCameraOff ? (
          <div className="active-call__local-video active-call__local-video--placeholder">
            <div className="active-call__local-video__icon">Camera off</div>
          </div>
        ) : (
          <video ref={localVideoRef} className="active-call__local-video" autoPlay playsInline muted />
        )
      )}

      {callType === 'audio' && (
        <>
          <audio ref={remoteAudioRef} autoPlay />
          {audioPlaybackBlocked && (
            <div className="active-call__audio-fallback">
              <button type="button" className="audio-fallback-button" onClick={enableAudioPlayback}>
                Tap to enable audio
              </button>
            </div>
          )}
        </>
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
          className={`ctrl-btn ${isMuted ? 'ctrl-btn--off' : 'ctrl-btn--on'}`}
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button
          type="button"
          className={`ctrl-btn ${audioOutputSupported ? (speakerOn ? 'ctrl-btn--on' : 'ctrl-btn--off') : 'ctrl-btn--disabled'}`}
          onClick={toggleSpeaker}
          disabled={!audioOutputSupported}
          aria-label={audioOutputSupported ? (speakerOn ? 'Speaker on' : 'Speaker off') : 'Speaker control unavailable'}
          title={audioOutputSupported ? (speakerOn ? 'Speaker on' : 'Speaker off') : 'Speaker control unavailable'}
        >
          {speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>

        {callType === 'video' && (
          <button
            type="button"
            className={`ctrl-btn ${isCameraOff ? 'ctrl-btn--off' : 'ctrl-btn--on'}`}
            onClick={onToggleCamera}
            aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        <button
          type="button"
          className="ctrl-btn ctrl-btn--end"
          onClick={onEndCall}
          aria-label="End call"
          title="End call"
        >
          <PhoneOff size={22} />
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
          min-width: 56px;
          min-height: 56px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #fff;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
          transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }

        .ctrl-btn:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.18);
        }

        .ctrl-btn:active {
          transform: scale(0.94);
        }

        .ctrl-btn--on {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }

        .ctrl-btn--off {
          background: rgba(236, 72, 153, 0.18);
          color: #f87171;
          box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.25);
        }

        .ctrl-btn--disabled {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.55);
          cursor: not-allowed;
          opacity: 0.65;
        }

        .ctrl-btn--end {
          background: var(--danger-main);
          width: 64px;
          height: 64px;
        }

        .ctrl-btn--end:hover {
          opacity: 0.92;
        }

        .active-call__local-video--placeholder {
          position: absolute;
          z-index: 2;
          top: 20px;
          right: 20px;
          width: 110px;
          height: 150px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.45);
          color: #fff;
          text-align: center;
          font-size: 12px;
          line-height: 1.4;
          padding: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .active-call__audio-fallback {
          position: absolute;
          left: 50%;
          bottom: 140px;
          transform: translateX(-50%);
          z-index: 2;
        }

        .audio-fallback-button {
          color: #fff;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 14px;
          cursor: pointer;
          backdrop-filter: blur(12px);
        }

        .audio-fallback-button:hover {
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
