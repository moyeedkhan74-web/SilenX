import React, { useEffect, useRef } from 'react';
import { Phone, X, Video } from 'lucide-react';
import './CallOverlay.css';
import { useCallStore } from '../store/callStore';
import { webrtcService } from '../services/webrtc';
import { Avatar } from './Avatar';

const CallOverlay: React.FC = () => {
  const {
    isInCall,
    callStatus,
    callType,
    callerName,
    callerAvatarUrl,
    duration,
    isAudioMuted,
    isVideoOff,
    toggleAudio,
    toggleVideo,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isInCall) {
      return;
    }

    webrtcService.setVideoElements(localVideoRef.current, remoteVideoRef.current);
  }, [isInCall]);

  if (!isInCall) return null;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAccept = async () => {
    await webrtcService.acceptIncomingCall();
  };

  const handleReject = () => {
    webrtcService.rejectCall();
  };

  const handleEndCall = () => {
    webrtcService.endCall();
  };

  const handleToggleAudio = () => {
    webrtcService.toggleAudio(!isAudioMuted);
    toggleAudio();
  };

  const handleToggleVideo = () => {
    webrtcService.toggleVideo(!isVideoOff);
    toggleVideo();
  };

  return (
    <div className="call-overlay incoming-animation">
      {callStatus === 'pending' ? (
        <div className="incoming-call-panel">
          <div className="incoming-background" />
          <div className="incoming-card">
            <div className="incoming-avatar-shell">
              <div className="incoming-avatar-ring incoming-avatar-ring-1" />
              <div className="incoming-avatar-ring incoming-avatar-ring-2" />
              <div className="incoming-avatar-ring incoming-avatar-ring-3" />
              <div className="incoming-avatar-inner">
                <Avatar name={callerName || 'Caller'} size={120} avatarUrl={callerAvatarUrl || null} />
                {callType === 'video' && (
                  <div className="incoming-camera-badge">
                    <Video size={14} />
                  </div>
                )}
              </div>
            </div>
            <div className="incoming-copy">
              <h2>{callerName || 'Unknown caller'}</h2>
              <p className="incoming-subtitle">
                Incoming {callType} call...
              </p>
            </div>
            <div className="incoming-button-row">
              <button
                className="incoming-action-btn reject"
                onClick={handleReject}
                type="button"
                aria-label="Reject call"
              >
                <X size={24} />
              </button>
              <button
                className="incoming-action-btn accept"
                onClick={handleAccept}
                type="button"
                aria-label="Accept call"
              >
                <Phone size={24} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="call-active-panel">
          <div className="call-video-container remote">
            {callType === 'video' ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            ) : (
              <div className="video-placeholder">{callerName?.[0]}</div>
            )}

            {callType === 'video' && (
              <div className="call-video-container local-pip">
                <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                {isVideoOff && <div className="pip-placeholder">Camera Off</div>}
              </div>
            )}
          </div>

          <div className="call-controls-bar">
            <div className="call-info-badge">
              <span className="encryption-badge-sm" style={{ marginRight: 8 }}>🔒 E2EE</span>
              {formatDuration(duration)}
            </div>
            <div className="call-actions-row">
              <button
                className={`call-control-btn ${isAudioMuted ? 'muted' : ''}`}
                onClick={handleToggleAudio}
              >
                {isAudioMuted ? '🔇' : '🎤'}
              </button>
              {callType === 'video' && (
                <button
                  className={`call-control-btn ${isVideoOff ? 'muted' : ''}`}
                  onClick={handleToggleVideo}
                >
                  {isVideoOff ? '🚫' : '📹'}
                </button>
              )}
              <button className="call-control-btn end-call" onClick={handleEndCall}>📞</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallOverlay;