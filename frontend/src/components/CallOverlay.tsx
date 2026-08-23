import React, { useEffect, useState } from 'react';
import './CallOverlay.css';
import ActiveCallScreen from './ActiveCallScreen';
import IncomingCallScreen from './IncomingCallScreen';
import { useCallStore } from '../store/callStore';
import { livekitService } from '../services/livekit';

const CallOverlay: React.FC = () => {
  const {
    isInCall,
    callStatus,
    callType,
    callerName,
    callerAvatarUrl,
    isCaller,
    isRinging,
    isAudioMuted,
    isVideoOff,
    toggleAudio,
    toggleVideo,
  } = useCallStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(livekitService.getLocalStream());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(livekitService.getRemoteStream());

  useEffect(() => {
    const unsubscribe = livekitService.subscribeToStreamUpdates((local, remote) => {
      setLocalStream(local);
      setRemoteStream(remote);
    });
    return unsubscribe;
  }, []);

  const isMicrophoneMuted = localStream ? livekitService.isMicrophoneMuted() : isAudioMuted;

  if (!isInCall) return null;

  const handleAccept = async () => {
    console.debug('[CallOverlay] accept button clicked');
    const success = await livekitService.acceptIncomingCall();
    if (!success) {
      const mediaError = livekitService.getMediaError();
      if (mediaError) {
        window.alert(mediaError);
      } else if (!window.isSecureContext) {
        window.alert('Media access requires a secure connection (HTTPS or localhost). Please check your URL.');
      } else {
        window.alert(
          'Unable to access your camera or microphone.\n\n' +
          'Please grant Camera and Microphone permissions for SilenX in your device settings:\n' +
          'Settings > Apps > SilenX > Permissions > Allow Camera & Microphone'
        );
      }
    }
  };

  const handleReject = () => {
    console.debug('[CallOverlay] reject button clicked');
    // livekitService.rejectCall() already calls resetCallState() â†’ endCall()
    livekitService.rejectCall();
  };

  const handleEndCall = () => {
    livekitService.endCall();
  };

  const handleCancelOutgoingCall = () => {
    console.debug('[CallOverlay] outgoing call canceled');
    livekitService.endCall();
  };

  const handleToggleAudio = () => {
    const newMuted = livekitService.toggleAudio();
    if (newMuted !== isMicrophoneMuted) {
      toggleAudio();
    }
  };

  const handleToggleVideo = async () => {
    const newCameraOff = await livekitService.toggleVideo();
    // Always sync store to match actual WebRTC state
    const storeVideoOff = useCallStore.getState().isVideoOff;
    if (newCameraOff !== storeVideoOff) {
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
          isCaller={isCaller}
          isRinging={isRinging}
          onAccept={handleAccept}
          onReject={handleReject}
          onCancel={handleCancelOutgoingCall}
        />
      ) : callStatus === 'active' || callStatus === 'accepted' ? (
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

