import React, { useRef } from 'react';
import './CallOverlay.css';
import { useCallStore } from '../store/callStore';

const CallOverlay: React.FC = () => {
  const { 
    isInCall, callStatus, callType, callerName, 
    duration, isAudioMuted, isVideoOff,
    acceptCall, rejectCall, endCall, toggleAudio, toggleVideo 
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  if (!isInCall) return null;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-overlay">
      {callStatus === 'pending' ? (
        <div className="call-incoming-panel">
          <div className="call-avatar-lg">{callerName?.[0] || '?'}</div>
          <h2>{callerName}</h2>
          <p>Incoming {callType} call...</p>
          <div className="call-actions">
            <button className="call-btn reject" onClick={rejectCall}>✖ Reject</button>
            <button className="call-btn accept" onClick={acceptCall}>📞 Accept</button>
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
                onClick={toggleAudio}
              >
                {isAudioMuted ? '🔇' : '🎤'}
              </button>
              {callType === 'video' && (
                <button 
                  className={`call-control-btn ${isVideoOff ? 'muted' : ''}`} 
                  onClick={toggleVideo}
                >
                  {isVideoOff ? '🚫' : '📹'}
                </button>
              )}
              <button className="call-control-btn end-call" onClick={endCall}>📞</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallOverlay;
