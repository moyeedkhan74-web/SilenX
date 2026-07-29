import type { Socket } from 'socket.io-client';
import { WEBRTC_CONFIG } from '../config/webrtc-config';
import { connectSocket, getSocket } from './socket';
import { useCallStore } from '../store/callStore';
import type { CallType } from '../types';

interface CallIncomingPayload {
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  callType: CallType;
  callLogId?: string;
}

interface CallAcceptedPayload {
  responderId: string;
  responderName: string;
  callLogId?: string;
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
  private callLogId: string | null = null;
  private callStartTimestamp: number | null = null;
  private callTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private static CALL_TIMEOUT_MS = 45_000;

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
    socket.on('call-log-id', this.handleCallLogId);
    socket.on('sdp-offer-received', this.handleRemoteOffer);
    socket.on('sdp-answer-received', this.handleRemoteAnswer);
    socket.on('ice-candidate-received', this.handleIceCandidateReceived);
  }

  private detachSocketListeners(socket: Socket): void {
    socket.off('call-incoming', this.handleIncomingCall);
    socket.off('call-accepted', this.handleCallAccepted);
    socket.off('call-rejected', this.handleCallRejected);
    socket.off('call-ended', this.handleRemoteCallEnded);
    socket.off('call-log-id', this.handleCallLogId);
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

  private ringInterval: any = null;
  private currentFacingMode: 'user' | 'environment' = 'user';

  private async startRingTone(isOutgoing: boolean): Promise<void> {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      this.stopRingTone();

      const ctx = new AudioContextCtor();
      this.audioContext = ctx;

      const playPulse = () => {
        if (!this.audioContext || this.audioContext.state === 'closed') return;
        try {
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.value = isOutgoing ? 440 : 425;
          osc2.frequency.value = isOutgoing ? 480 : 450;

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.05, now + 0.08);
          gain.gain.setValueAtTime(0.05, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.4);
          osc2.stop(now + 1.4);
        } catch {
          // ignore
        }
      };

      await ctx.resume().catch(() => null);
      playPulse();
      this.ringInterval = setInterval(playPulse, 3200);
    } catch (error) {
      console.warn('[WebRTC] Ring tone could not be started', error);
    }
  }

  private stopRingTone(): void {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close().catch(() => null);
      } catch {}
    }

    this.audioContext = null;
  }

  public async switchCamera(): Promise<boolean> {
    if (!this.localStream || this.currentCallType !== 'video') {
      return false;
    }

    const currentTrack = this.localStream.getVideoTracks()[0];
    if (!currentTrack) {
      return false;
    }

    const nextFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';

    try {
      // 1. Stop the current video track BEFORE requesting the new one.
      // Crucial on Android Chrome / WebViews where camera hardware locking prevents simultaneous access.
      currentTrack.stop();
      this.localStream.removeTrack(currentTrack);

      // 2. Add a brief cool-off period for the Android hardware camera subsystem to release resources.
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 3. Acquire the camera stream requesting exact constraints first, fallback to ideal, fallback to device enumeration.
      let newCameraStream: MediaStream;
      try {
        newCameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode } },
        });
      } catch (err) {
        console.warn('[WebRTC] exact facingMode failed, falling back to ideal constraints', err);
        try {
          newCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: nextFacingMode } },
          });
        } catch (err2) {
          console.warn('[WebRTC] ideal facingMode failed, checking device list', err2);
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          if (videoDevices.length > 1) {
            const targetLabel = nextFacingMode === 'environment' ? 'back' : 'front';
            const targetLabelAlt = nextFacingMode === 'environment' ? 'rear' : 'user';
            const otherDevice = videoDevices.find((d) => 
              d.label.toLowerCase().includes(targetLabel) || 
              d.label.toLowerCase().includes(targetLabelAlt)
            ) || videoDevices[1];

            newCameraStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: otherDevice.deviceId } },
            });
          } else if (videoDevices.length === 1) {
            newCameraStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: videoDevices[0].deviceId } },
            });
          } else {
            throw new Error('No video devices found during fallback');
          }
        }
      }

      const newTrack = newCameraStream.getVideoTracks()[0];
      if (!newTrack) {
        throw new Error('No video track returned from new camera stream');
      }

      newTrack.enabled = true;

      // 4. Update the track on the peer connection sender
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          this.peerConnection.addTrack(newTrack, this.localStream);
        }
      }

      // 5. Rebuild the stream reference object so React state bindings recognize the change
      const freshStream = new MediaStream();
      this.localStream.getAudioTracks().forEach((t) => freshStream.addTrack(t));
      freshStream.addTrack(newTrack);
      this.localStream = freshStream;
      this.currentFacingMode = nextFacingMode;

      // 6. Update video element directly as a fast path
      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }

      this.notifyStreamListeners();
      return true;
    } catch (error) {
      console.error('[WebRTC] Exception during switchCamera:', error);
      // Recovery fallback: Try to re-establish the original camera view
      try {
        const recoveryStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: this.currentFacingMode } },
        });
        const recTrack = recoveryStream.getVideoTracks()[0];
        if (recTrack) {
          if (this.peerConnection) {
            const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) await sender.replaceTrack(recTrack);
          }
          const freshStream = new MediaStream();
          this.localStream.getAudioTracks().forEach((t) => freshStream.addTrack(t));
          freshStream.addTrack(recTrack);
          this.localStream = freshStream;
          if (this.localVideoElement) {
            this.localVideoElement.srcObject = this.localStream;
          }
          this.notifyStreamListeners();
        }
      } catch (recoveryErr) {
        console.error('[WebRTC] Failed to recover original camera state:', recoveryErr);
      }
      return false;
    }
  }

  private clearPendingOutboundCall(): void {
    this.stopRingTone();
    this.clearCallTimeout();
    useCallStore.getState().endCall();
    this.stopCall();
    this.targetUserId = null;
    this.currentCallType = null;
    this.isCaller = false;
    this.callLogId = null;
    this.callStartTimestamp = null;
  }

  private async waitForSocketReady(socket: Socket): Promise<boolean> {
    if (socket.connected) {
      return true;
    }

    if (socket.disconnected) {
      socket.connect();
    }

    return new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(false);
      }, 5_000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
      };

      const onConnect = () => {
        cleanup();
        resolve(true);
      };

      const onConnectError = () => {
        cleanup();
        resolve(false);
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onConnectError);
    });
  }

  public async startCall(
    targetUserId: string,
    callType: CallType,
    targetName: string,
    callerName: string,
    callerAvatarUrl?: string
  ): Promise<boolean> {
    let socket = getSocket();
    if (!socket) {
      socket = connectSocket();
    }

    if (!socket) {
      console.warn('[WebRTC] Unable to start call because no socket is available');
      return false;
    }

    this.initialize(socket);
    const socketReady = await this.waitForSocketReady(socket);
    if (!socketReady) {
      console.warn('[WebRTC] Unable to start call because the socket did not connect in time');
      return false;
    }
    this.targetUserId = targetUserId;
    this.currentCallType = callType;
    this.isCaller = true;

    useCallStore.getState().initiateCall(callType, targetUserId, targetName);

    const ready = await this.prepareLocalMediaAndConnection(callType);
    if (!ready) {
      console.warn('[WebRTC] Outgoing call failed because local media access was denied or unavailable');
      this.clearPendingOutboundCall();
      return false;
    }

    this.startRingTone(true).catch(() => undefined);

    socket.emit('call-initiate', {
      targetUserId,
      callerName,
      callerAvatarUrl,
      callType,
    });

    // Auto-cancel if no answer within timeout
    this.clearCallTimeout();
    this.callTimeoutTimer = setTimeout(() => {
      if (useCallStore.getState().callStatus === 'pending' && this.isCaller) {
        console.warn('[WebRTC] Call timed out — no answer received');
        this.endCall();
      }
    }, WebRTCService.CALL_TIMEOUT_MS);

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
    socket.emit('call-accept', {
      targetUserId: this.targetUserId,
      callLogId: this.callLogId,
    });
    this.callStartTimestamp = Date.now();
    useCallStore.getState().acceptCall();
    return true;
  }

  public rejectCall(): void {
    if (this.targetUserId) {
      console.debug('[WebRTC] rejectCall sending call-reject to', this.targetUserId);
      getSocket()?.emit('call-reject', {
        targetUserId: this.targetUserId,
        callLogId: this.callLogId,
      });
    }
    this.stopRingTone();
    this.resetCallState();
  }

  public endCall(): void {
    if (this.targetUserId) {
      const durationSeconds = this.callStartTimestamp
        ? Math.floor((Date.now() - this.callStartTimestamp) / 1000)
        : undefined;
      getSocket()?.emit('call-end', {
        targetUserId: this.targetUserId,
        callLogId: this.callLogId,
        durationSeconds,
      });
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
    this.notifyStreamListeners();
    return this.isCameraOff();
  }

  /**
   * Re-acquire the camera video track after it was disabled/stopped.
   * This is needed because the UI unmounts the <video> element when
   * camera is off, so simply setting track.enabled = true may not be
   * enough — the track may have been stopped or the element gone.
   */
  public async reEnableCamera(): Promise<boolean> {
    if (!this.localStream || this.currentCallType !== 'video') {
      return false;
    }

    try {
      // 1. Stop and remove all existing video tracks FIRST to avoid hardware conflicts.
      this.localStream.getVideoTracks().forEach((t) => {
        t.stop();
        this.localStream!.removeTrack(t);
      });

      // 2. Quick device release delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 3. Acquire new video track
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.currentFacingMode } },
      });
      const newTrack = cameraStream.getVideoTracks()[0];
      if (!newTrack) return false;

      newTrack.enabled = true;

      // 4. Add the fresh track to the stream
      this.localStream.addTrack(newTrack);

      // 5. Replace/add track on peer connection
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          this.peerConnection.addTrack(newTrack, this.localStream);
        }
      }

      // 6. Refresh stream reference for React bindings
      const freshStream = new MediaStream();
      this.localStream.getTracks().forEach((t) => freshStream.addTrack(t));
      this.localStream = freshStream;

      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }

      this.notifyStreamListeners();
      return true;
    } catch (error) {
      console.warn('[WebRTC] Error re-enabling camera:', error);
      return false;
    }
  }

  public toggleAudio(): boolean {
    const currentMuted = this.isMicrophoneMuted();
    return this.setMicrophoneMuted(!currentMuted);
  }

  /**
   * Toggle video on/off. When turning the camera back ON, we re-acquire
   * the video track (async) because the old track may have been stopped
   * and the UI video element was unmounted.
   * Returns a Promise<boolean> indicating the new camera-off state.
   */
  public async toggleVideo(): Promise<boolean> {
    const currentOff = this.isCameraOff();

    if (currentOff) {
      // Turning camera ON — need to re-acquire track
      const success = await this.reEnableCamera();
      return success ? false : true; // false = camera is NOT off
    } else {
      // Turning camera OFF — just disable the track
      return this.setCameraOff(true);
    }
  }

  private async getUserMedia(callType: CallType): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video' ? { facingMode: 'user' } : false,
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
        console.debug('[WebRTC] ontrack event:', event.track.kind, event.streams);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        } else {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
          }
          this.remoteStream.addTrack(event.track);
        }

        event.track.enabled = true;

        // Force stream update notifications when a track changes mute/unmute state
        event.track.onmute = () => {
          console.log(`[WebRTC] Remote track muted: ${event.track.kind}`);
          this.notifyStreamListeners();
        };
        event.track.onunmute = () => {
          console.log(`[WebRTC] Remote track unmuted: ${event.track.kind}`);
          this.notifyStreamListeners();
        };

        if (this.remoteVideoElement) {
          this.remoteVideoElement.srcObject = this.remoteStream;
        }

        this.notifyStreamListeners();
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('[WebRTC] connectionState:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'failed') {
          console.warn('[WebRTC] Connection failed. Triggering ICE restart...');
          this.handleIceRestart();
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('[WebRTC] iceConnectionState:', this.peerConnection?.iceConnectionState);
        if (this.peerConnection?.iceConnectionState === 'failed') {
          console.warn('[WebRTC] ICE Connection failed. Triggering ICE restart...');
          this.handleIceRestart();
        }
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

  private async handleIceRestart(): Promise<void> {
    if (!this.peerConnection || !this.targetUserId) {
      return;
    }

    try {
      console.log('[WebRTC] Initiating ICE restart...');
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);

      getSocket()?.emit('sdp-offer', {
        targetUserId: this.targetUserId,
        sdp: offer,
      });
    } catch (error) {
      console.error('[WebRTC] Error during ICE restart:', error);
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
    this.callLogId = payload.callLogId || null;
    useCallStore.getState().receiveCall(
      payload.callerId,
      payload.callerName,
      payload.callerAvatarUrl || null,
      payload.callType,
      this.callLogId || undefined
    );
    this.startRingTone(false).catch(() => undefined);
  };

  private handleCallAccepted = async (payload: CallAcceptedPayload): Promise<void> => {
    if (!this.isCaller || !this.targetUserId || payload.responderId !== this.targetUserId || !this.currentCallType) {
      return;
    }

    this.stopRingTone();
    this.clearCallTimeout();
    const ready = await this.prepareLocalMediaAndConnection(this.currentCallType);
    if (!ready) {
      this.resetCallState();
      return;
    }

    // Capture callLogId from the accepted payload (if present)
    if (payload.callLogId && !this.callLogId) {
      this.callLogId = payload.callLogId;
      useCallStore.getState().setCallLogId(this.callLogId!);
    }

    useCallStore.getState().acceptCall();
    this.callStartTimestamp = Date.now();
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
    if (!payload?.candidate) {
      return;
    }

    console.debug('[WebRTC] received ICE candidate from', payload.senderId, payload.candidate);
    try {
      if (!this.peerConnection || !this.remoteDescriptionSet) {
        console.debug('[WebRTC] buffering ICE candidate until peerConnection & remote description are set');
        this.pendingIceCandidates.push(payload.candidate);
        return;
      }
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (error) {
      console.warn('[WebRTC] Error adding ICE candidate:', error);
    }
  };

  private clearCallTimeout(): void {
    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }
  }

  private resetCallState(): void {
    this.stopRingTone();
    this.clearCallTimeout();
    useCallStore.getState().endCall();
    this.stopCall();
    this.targetUserId = null;
    this.currentCallType = null;
    this.isCaller = false;
    this.callLogId = null;
    this.callStartTimestamp = null;
  }

  private handleCallLogId = (payload: { callLogId: string }): void => {
    if (payload?.callLogId) {
      this.callLogId = payload.callLogId;
      useCallStore.getState().setCallLogId(payload.callLogId);
      console.debug('[WebRTC] received callLogId:', payload.callLogId);
    }
  };

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
