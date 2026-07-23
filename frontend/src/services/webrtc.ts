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

    socket.emit('call-initiate', {
      targetUserId,
      callerName,
      callerAvatarUrl,
      callType,
    });

    return true;
  }

  public async acceptIncomingCall(): Promise<void> {
    if (!this.targetUserId || !this.currentCallType) {
      console.debug('[WebRTC] acceptIncomingCall skipped, no target or call type');
      return;
    }

    const socket = getSocket();
    if (!socket) {
      console.debug('[WebRTC] acceptIncomingCall skipped, socket unavailable');
      return;
    }

    console.debug('[WebRTC] acceptIncomingCall sending call-accept to', this.targetUserId);

    const ready = await this.prepareLocalMediaAndConnection(this.currentCallType);
    if (!ready) {
      console.debug('[WebRTC] acceptIncomingCall failed to get media or peer connection');
      useCallStore.getState().rejectCall();
      return;
    }

    socket.emit('call-accept', { targetUserId: this.targetUserId });
    useCallStore.getState().acceptCall();
  }

  public rejectCall(): void {
    if (this.targetUserId) {
      console.debug('[WebRTC] rejectCall sending call-reject to', this.targetUserId);
      getSocket()?.emit('call-reject', { targetUserId: this.targetUserId });
    }
    this.resetCallState();
  }

  public endCall(): void {
    if (this.targetUserId) {
      getSocket()?.emit('call-end', { targetUserId: this.targetUserId });
    }
    this.resetCallState();
  }

  public toggleAudio(mute: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !mute;
      });
    }
  }

  public toggleVideo(off: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !off;
      });
    }
  }

  private async getUserMedia(callType: CallType): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video',
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }

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
          getSocket()?.emit('ice-candidate', {
            targetUserId: this.targetUserId,
            candidate: event.candidate,
          });
        }
      };

      this.peerConnection.ontrack = (event) => {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
          if (this.remoteVideoElement) {
            this.remoteVideoElement.srcObject = this.remoteStream;
          }
        }

        this.remoteStream.addTrack(event.track);
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', this.peerConnection?.connectionState);
      };
    } catch (error) {
      console.error('[WebRTC] Error creating peer connection:', error);
      this.peerConnection = null;
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
  };

  private handleCallAccepted = async (payload: CallAcceptedPayload): Promise<void> => {
    if (!this.isCaller || !this.targetUserId || payload.responderId !== this.targetUserId || !this.currentCallType) {
      return;
    }

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
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

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
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } catch (error) {
      console.error('[WebRTC] Error handling remote answer:', error);
    }
  };

  private handleIceCandidateReceived = async (payload: ICECandidateReceivedPayload): Promise<void> => {
    if (!this.peerConnection || !payload?.candidate) {
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (error) {
      console.warn('[WebRTC] Error adding ICE candidate:', error);
    }
  };

  private resetCallState(): void {
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

    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }
  }
}

export const webrtcService = new WebRTCService();
