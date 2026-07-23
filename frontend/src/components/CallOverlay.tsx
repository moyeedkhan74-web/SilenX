import React from 'react';
import './CallOverlay.css';
import ActiveCallScreen from './ActiveCallScreen';
import IncomingCallScreen from './IncomingCallScreen';
import { useCallStore } from '../store/callStore';
import { webrtcService } from '../services/webrtc';

const CallOverlay: React.FC = () => {
  const {
    isInCall,
    callStatus,
    callType,
    callerName,
    callerAvatarUrl,
    isAudioMuted,
    isVideoOff,
    toggleAudio,
    toggleVideo,
  } = useCallStore();

  const localStream = webrtcService.getLocalStream();
  const remoteStream = webrtcService.getRemoteStream();

  if (!isInCall) return null;

  const handleAccept = async () => {
    console.debug('[CallOverlay] accept button clicked');
    const accepted = await webrtcService.acceptIncomingCall();
    if (accepted) {
      useCallStore.getState().acceptCall();
    }
  };

  const handleReject = () => {
    console.debug('[CallOverlay] reject button clicked');
    useCallStore.getState().declineCall();
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
        <IncomingCallScreen
          callerName={callerName}
          callerAvatarUrl={callerAvatarUrl}
          callType={callType}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      ) : callStatus === 'active' ? (
        <ActiveCallScreen
          callerName={callerName || 'Unknown caller'}
          callerAvatarUrl={callerAvatarUrl || undefined}
          callType={callType || 'audio'}
          isMuted={isAudioMuted}
          isCameraOff={isVideoOff}
          localStream={localStream}
          remoteStream={remoteStream}
          onToggleMute={handleToggleAudio}
          onToggleCamera={handleToggleVideo}
          onEndCall={handleEndCall}
        />
      ) : null}
    </div>
  );
};

export default CallOverlay;