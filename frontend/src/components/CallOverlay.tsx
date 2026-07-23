import React, { useEffect, useRef } from 'react';
import './CallOverlay.css';
import { useCallStore } from '../store/callStore';
import { webrtcService } from '../services/webrtc';

const CallOverlay: React.FC = () => {
  const {
    isInCall,
    callStatus,
    callType,
    callerName,
    isCaller,
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
    <div className="call-overlay">
      {callStatus === 'pending' ? (
        isCaller ? (
          <div className="call-incoming-panel">
            <div className="call-avatar-lg">{callerName?.[0] || '?'}</div>
            <h2>{callerName}</h2>
            <p>Calling {callType}...</p>
            <div className="call-actions">
              <button className="call-btn reject" onClick={handleReject}>✖ Cancel</button>
            </div>
          </div>
        ) : (
          <div className="call-incoming-panel">
            <div className="call-avatar-lg">{callerName?.[0] || '?'}</div>
            <h2>{callerName}</h2>
            <p>Incoming {callType} call...</p>
            <div className="call-actions">
              <button className="call-btn reject" onClick={handleReject}>✖ Reject</button>
              <button className="call-btn accept" onClick={handleAccept}>📞 Accept</button>
            </div>
          </div>
        )
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