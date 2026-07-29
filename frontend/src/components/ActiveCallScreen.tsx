import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { Avatar } from './Avatar';
import { webrtcService } from '../services/webrtc';

import './ActiveCallScreen.css';

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

  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Timer ticker
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isVideo = callType === 'video';
  const showRemoteVideo = isVideo && remoteStream;

  // Register video elements directly to WebRTC Service for seamless switching
  useEffect(() => {
    webrtcService.setVideoElements(localVideoRef.current, remoteVideoRef.current);
    return () => {
      webrtcService.setVideoElements(null, null);
    };
  }, [localStream, remoteStream, isCameraOff, showRemoteVideo]);

  // Local video stream binding
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream]);

  // Remote video stream binding
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.volume = speakerOn ? 1 : 0;
      remoteVideoRef.current
        .play()
        .catch((error) => console.warn('[ActiveCallScreen] remote video autoplay blocked', error));
    }
  }, [remoteStream, speakerOn]);

  // Remote audio stream binding (Only bind on remoteStream updates; speaker toggles directly set volume to avoid reload glitches)
  useEffect(() => {
    if (!remoteAudioRef.current || !remoteStream) return;

    if (remoteAudioRef.current.srcObject !== remoteStream) {
      console.debug('[ActiveCallScreen] Binding remoteStream to audio element. Audio tracks:', remoteStream.getAudioTracks().length);
      remoteAudioRef.current.srcObject = remoteStream;
    }
    remoteAudioRef.current.volume = speakerOn ? 1.0 : 0;

    remoteAudioRef.current
      .play()
      .then(() => setAudioPlaybackBlocked(false))
      .catch((error) => {
        console.warn('[ActiveCallScreen] remote audio autoplay blocked:', error);
        setAudioPlaybackBlocked(true);
      });
  }, [remoteStream]);

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

    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = nextSpeakerOn ? 1.0 : 0;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = nextSpeakerOn ? 1.0 : 0;
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


  return (
    <div ref={containerRef} className={`active-call ${isFullscreen ? 'active-call--fullscreen' : ''}`}>
      <div className="active-call__backdrop" />

      {/* Dedicated Remote Audio Element for guaranteed voice playback (using layout-safe positioning instead of display: none to prevent mobile throttling) */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />

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

      {/* Audio Playback Fallback Button */}
      {audioPlaybackBlocked && (
        <div className="active-call__audio-fallback">
          <button type="button" className="audio-fallback-button" onClick={enableAudioPlayback}>
            🔊 Tap to Unmute Remote Voice
          </button>
        </div>
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
            className={`ctrl-btn ${speakerOn ? 'ctrl-btn--on ctrl-btn--speaker-on' : 'ctrl-btn--muted'}`}
            onClick={toggleSpeaker}
            aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}
            title={speakerOn ? 'Speaker On' : 'Speaker Off'}
          >
            {speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          <span className="ctrl-btn-label">{speakerOn ? 'Speaker' : 'Off'}</span>
        </div>

        {/* Camera Toggle Button (Video Calls Only) */}
        {isVideo && (
          <>
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

            <div className="ctrl-btn-wrapper">
              <button
                type="button"
                className="ctrl-btn ctrl-btn--on ctrl-btn--flip"
                onClick={() => webrtcService.switchCamera()}
                aria-label="Flip camera angle"
                title="Flip Camera Angle (Front/Back)"
              >
                <RefreshCw size={20} className="flip-cam-icon" />
              </button>
              <span className="ctrl-btn-label">Flip Cam</span>
            </div>
          </>
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
    </div>
  );
}
