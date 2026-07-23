import React, { useEffect, useState } from 'react';
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

  const [localStream, setLocalStream] = useState<MediaStream | null>(webrtcService.getLocalStream());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(webrtcService.getRemoteStream());

  useEffect(() => {
    const unsubscribe = webrtcService.subscribeToStreamUpdates((local, remote) => {
      setLocalStream(local);
      setRemoteStream(remote);
    });
    return unsubscribe;
  }, []);

  const isMicrophoneMuted = localStream ? webrtcService.isMicrophoneMuted() : isAudioMuted;
  const isCameraOff = localStream ? webrtcService.isCameraOff() : isVideoOff;

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
    const newMuted = webrtcService.toggleAudio();
    if (newMuted !== isMicrophoneMuted) {
      toggleAudio();
    }
  };

  const handleToggleVideo = () => {
    const newCameraOff = webrtcService.toggleVideo();
    if (newCameraOff !== isCameraOff) {
      toggleVideo();
    }
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