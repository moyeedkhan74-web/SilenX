import type { Socket } from 'socket.io-client';
import { WEBRTC_CONFIG } from '../config/webrtc-config';
import { getSocket } from './socket';
import { useCallStore } from '../store/callStore';
import type { CallType } from '../types';

interface CallIncomingPayload {
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  callType: CallType;
}

interface CallAcceptedPayload {
  responderId: string;
  responderName: string;
}

interface CallRejectedPayload {
  by: string;
}

interface CallEndedPayload {
  by: string;
}

interface SDPReceivedPayload {
  sdp: RTCSessionDescriptionInit;
  senderId: string;
}

interface ICECandidateReceivedPayload {
  candidate: RTCIceCandidateInit;
  senderId: string;
}

export class WebRTCService {
  private currentSocket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;
  private targetUserId: string | null = null;
  private currentCallType: CallType | null = null;
  private isCaller = false;
  private localTracksAdded = false;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private streamListeners = new Set<(local: MediaStream | null, remote: MediaStream | null) => void>();
  private audioContext: AudioContext | null = null;
  private ringOscillator: OscillatorNode | null = null;

  public initialize(socket: Socket): void {
    if (this.currentSocket === socket) {
      return;
    }

    if (this.currentSocket) {
      this.detachSocketListeners(this.currentSocket);
    }

    this.currentSocket = socket;
    this.attachSocketListeners(socket);
  }

  private attachSocketListeners(socket: Socket): void {
    socket.on('call-incoming', this.handleIncomingCall);
    socket.on('call-accepted', this.handleCallAccepted);
    socket.on('call-rejected', this.handleCallRejected);
    socket.on('call-ended', this.handleRemoteCallEnded);
    socket.on('sdp-offer-received', this.handleRemoteOffer);
    socket.on('sdp-answer-received', this.handleRemoteAnswer);
    socket.on('ice-candidate-received', this.handleIceCandidateReceived);
  }

  private detachSocketListeners(socket: Socket): void {
    socket.off('call-incoming', this.handleIncomingCall);
    socket.off('call-accepted', this.handleCallAccepted);
    socket.off('call-rejected', this.handleCallRejected);
    socket.off('call-ended', this.handleRemoteCallEnded);
    socket.off('sdp-offer-received', this.handleRemoteOffer);
    socket.off('sdp-answer-received', this.handleRemoteAnswer);
    socket.off('ice-candidate-received', this.handleIceCandidateReceived);
  }

  public setVideoElements(localVideoElement: HTMLVideoElement | null, remoteVideoElement: HTMLVideoElement | null): void {
    this.localVideoElement = localVideoElement;
    this.remoteVideoElement = remoteVideoElement;

    if (this.localVideoElement && this.localStream) {
      this.localVideoElement.srcObject = this.localStream;
    }

    if (this.remoteVideoElement && this.remoteStream) {
      this.remoteVideoElement.srcObject = this.remoteStream;
    }
  }

  public subscribeToStreamUpdates(
    listener: (local: MediaStream | null, remote: MediaStream | null) => void
  ): () => void {
    this.streamListeners.add(listener);
    listener(this.localStream, this.remoteStream);
    return () => {
      this.streamListeners.delete(listener);
    };
  }

  private notifyStreamListeners(): void {
    for (const listener of this.streamListeners) {
      listener(this.localStream, this.remoteStream);
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private async startRingTone(isOutgoing: boolean): Promise<void> {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      if (this.audioContext) {
        return;
      }

      const ctx = new AudioContextCtor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.value = isOutgoing ? 480 : 420;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      await ctx.resume();

      this.audioContext = ctx;
      this.ringOscillator = oscillator;
    } catch (error) {
      console.warn('[WebRTC] Ring tone could not be started', error);
    }
  }

  private stopRingTone(): void {
    if (this.ringOscillator) {
      try {
        this.ringOscillator.stop();
      } catch {
        // ignore
      }
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => null);
    }
    this.audioContext = null;
    this.ringOscillator = null;
  }

  public async startCall(
    targetUserId: string,
    callType: CallType,
    targetName: string,
    callerName: string,
    callerAvatarUrl?: string
  ): Promise<boolean> {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      return false;
    }

    this.initialize(socket);
    this.targetUserId = targetUserId;
    this.currentCallType = callType;
    this.isCaller = true;

    useCallStore.getState().initiateCall(callType, targetUserId, targetName);
    this.startRingTone(true).catch(() => undefined);

    socket.emit('call-initiate', {
      targetUserId,
      callerName,
      callerAvatarUrl,
      callType,
    });

    return true;
  }

  public async acceptIncomingCall(): Promise<boolean> {
    if (!this.targetUserId || !this.currentCallType) {
      console.debug('[WebRTC] acceptIncomingCall skipped, no target or call type');
      return false;
    }

    const socket = getSocket();
    if (!socket) {
      console.debug('[WebRTC] acceptIncomingCall skipped, socket unavailable');
      return false;
    }

    console.debug('[WebRTC] acceptIncomingCall sending call-accept to', this.targetUserId);
    this.stopRingTone();

    const ready = await this.prepareLocalMediaAndConnection(this.currentCallType);
    if (!ready) {
      console.debug('[WebRTC] acceptIncomingCall failed to get media or peer connection');
      useCallStore.getState().rejectCall();
      return false;
    }

    console.debug('[WebRTC] emitting call-accept');
    socket.emit('call-accept', { targetUserId: this.targetUserId });
    return true;
  }

  public rejectCall(): void {
    if (this.targetUserId) {
      console.debug('[WebRTC] rejectCall sending call-reject to', this.targetUserId);
      getSocket()?.emit('call-reject', { targetUserId: this.targetUserId });
    }
    this.stopRingTone();
    this.resetCallState();
  }

  public endCall(): void {
    if (this.targetUserId) {
      getSocket()?.emit('call-end', { targetUserId: this.targetUserId });
    }
    this.stopRingTone();
    this.resetCallState();
  }

  public isMicrophoneMuted(): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    return audioTracks.length > 0 && audioTracks.every((track) => !track.enabled);
  }

  public isCameraOff(): boolean {
    if (!this.localStream) return true;
    const videoTracks = this.localStream.getVideoTracks();
    return videoTracks.length === 0 || videoTracks.every((track) => !track.enabled);
  }

  public setMicrophoneMuted(muted: boolean): boolean {
    if (!this.localStream) return muted;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return muted;
    audioTracks.forEach((track) => {
      track.enabled = !muted;
    });
    return this.isMicrophoneMuted();
  }

  public setCameraOff(off: boolean): boolean {
    if (!this.localStream) return off;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return off;
    videoTracks.forEach((track) => {
      track.enabled = !off;
    });
    return this.isCameraOff();
  }

  public toggleAudio(): boolean {
    const currentMuted = this.isMicrophoneMuted();
    return this.setMicrophoneMuted(!currentMuted);
  }

  public toggleVideo(): boolean {
    const currentOff = this.isCameraOff();
    return this.setCameraOff(!currentOff);
  }

  private async getUserMedia(callType: CallType): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video',
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.debug('[WebRTC] getUserMedia success, tracks:', this.localStream.getTracks().map((track) => track.kind));

      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }

      this.notifyStreamListeners();
      return true;
    } catch (error) {
      console.error('[WebRTC] Error accessing media devices:', error);
      return false;
    }
  }

  private createPeerConnection(): void {
    if (this.peerConnection) {
      return;
    }

    try {
      this.peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.targetUserId) {
          console.debug('[WebRTC] sending ICE candidate to', this.targetUserId, event.candidate);
          getSocket()?.emit('ice-candidate', {
            targetUserId: this.targetUserId,
            candidate: event.candidate,
          });
        }
      };

      this.peerConnection.ontrack = (event) => {
        console.debug('[WebRTC] ontrack event', event.streams.length, event.streams);
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        this.remoteStream.addTrack(event.track);

        if (this.remoteVideoElement) {
          this.remoteVideoElement.srcObject = this.remoteStream;
        }

        this.notifyStreamListeners();
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('[WebRTC] connectionState:', this.peerConnection?.connectionState);
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('[WebRTC] iceConnectionState:', this.peerConnection?.iceConnectionState);
      };

      this.peerConnection.onicegatheringstatechange = () => {
        console.log('[WebRTC] iceGatheringState:', this.peerConnection?.iceGatheringState);
      };

      this.peerConnection.onsignalingstatechange = () => {
        console.log('[WebRTC] signalingState:', this.peerConnection?.signalingState);
      };
    } catch (error) {
      console.error('[WebRTC] Error creating peer connection:', error);
      this.peerConnection = null;
    }
  }

  private async ensureRemoteDescriptionSet(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('[WebRTC] cannot set remote description: peerConnection is not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    this.remoteDescriptionSet = true;

    if (this.pendingIceCandidates.length > 0) {
      console.debug('[WebRTC] draining pending ICE candidate queue', this.pendingIceCandidates.length);
      for (const candidate of this.pendingIceCandidates) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.warn('[WebRTC] Error adding buffered ICE candidate:', error, candidate);
        }
      }
      this.pendingIceCandidates = [];
    }
  }

  private addLocalTracksToPeerConnection(): void {
    if (!this.peerConnection || !this.localStream || this.localTracksAdded) {
      return;
    }

    this.localStream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, this.localStream as MediaStream);
    });

    this.localTracksAdded = true;
  }

  private async prepareLocalMediaAndConnection(callType: CallType): Promise<boolean> {
    if (!this.localStream) {
      const gotMedia = await this.getUserMedia(callType);
      if (!gotMedia) {
        return false;
      }
    }

    this.createPeerConnection();
    this.addLocalTracksToPeerConnection();
    return !!this.peerConnection;
  }

  private async createOffer(): Promise<void> {
    if (!this.peerConnection || !this.targetUserId) {
      return;
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      getSocket()?.emit('sdp-offer', {
        targetUserId: this.targetUserId,
        sdp: offer,
      });
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
    }
  }

  private handleIncomingCall = async (payload: CallIncomingPayload): Promise<void> => {
    if (!payload?.callerId) {
      return;
    }

    if (useCallStore.getState().isInCall) {
      getSocket()?.emit('call-reject', { targetUserId: payload.callerId });
      return;
    }

    this.targetUserId = payload.callerId;
    this.currentCallType = payload.callType;
    this.isCaller = false;
    useCallStore.getState().receiveCall(payload.callerId, payload.callerName, payload.callerAvatarUrl || null, payload.callType);
    this.startRingTone(false).catch(() => undefined);
  };

  private handleCallAccepted = async (payload: CallAcceptedPayload): Promise<void> => {
    if (!this.isCaller || !this.targetUserId || payload.responderId !== this.targetUserId || !this.currentCallType) {
      return;
    }

    this.stopRingTone();
    const ready = await this.prepareLocalMediaAndConnection(this.currentCallType);
    if (!ready) {
      this.resetCallState();
      return;
    }

    useCallStore.getState().acceptCall();
    await this.createOffer();
  };

  private handleCallRejected = (_payload: CallRejectedPayload): void => {
    if (!this.isCaller) {
      return;
    }

    this.resetCallState();
  };

  private handleRemoteCallEnded = (_payload: CallEndedPayload): void => {
    this.resetCallState();
  };

  private handleRemoteOffer = async (payload: SDPReceivedPayload): Promise<void> => {
    if (!payload?.senderId) {
      return;
    }

    console.debug('[WebRTC] received remote offer from', payload.senderId, payload.sdp.type);
    this.targetUserId = this.targetUserId || payload.senderId;

    if (!this.currentCallType) {
      const state = useCallStore.getState();
      this.currentCallType = state.callType || 'audio';
    }

    const ready = await this.prepareLocalMediaAndConnection(this.currentCallType);
    if (!ready || !this.peerConnection) {
      this.resetCallState();
      return;
    }

    try {
      await this.ensureRemoteDescriptionSet(payload.sdp);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.debug('[WebRTC] sending SDP answer to', payload.senderId);
      getSocket()?.emit('sdp-answer', {
        targetUserId: payload.senderId,
        sdp: answer,
      });

      useCallStore.getState().acceptCall();
    } catch (error) {
      console.error('[WebRTC] Error handling remote offer:', error);
      this.resetCallState();
    }
  };

  private handleRemoteAnswer = async (payload: SDPReceivedPayload): Promise<void> => {
    if (!this.peerConnection) {
      return;
    }

    try {
      await this.ensureRemoteDescriptionSet(payload.sdp);
    } catch (error) {
      console.error('[WebRTC] Error handling remote answer:', error);
    }
  };

  private handleIceCandidateReceived = async (payload: ICECandidateReceivedPayload): Promise<void> => {
    if (!this.peerConnection || !payload?.candidate) {
      return;
    }
 
    console.debug('[WebRTC] received ICE candidate from', payload.senderId, payload.candidate);
    try {
      if (!this.remoteDescriptionSet) {
        console.debug('[WebRTC] buffering ICE candidate until remote description is set');
        this.pendingIceCandidates.push(payload.candidate);
        return;
      }
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (error) {
      console.warn('[WebRTC] Error adding ICE candidate:', error);
    }
  };

  private resetCallState(): void {
    this.stopRingTone();
    useCallStore.getState().endCall();
    this.stopCall();
    this.targetUserId = null;
    this.currentCallType = null;
    this.isCaller = false;
  }

  private stopCall(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.localTracksAdded = false;
    this.remoteDescriptionSet = false;
    this.pendingIceCandidates = [];
 
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }

    this.notifyStreamListeners();
  }
}

export const webrtcService = new WebRTCService();
