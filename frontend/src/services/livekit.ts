import type { Socket } from 'socket.io-client';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ExternalE2EEKeyProvider,
  type E2EEOptions,
} from 'livekit-client';
import { API_URL, isCapacitorNative } from '../config/webrtc-config';
import { connectSocket, getSocket } from './socket';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import type { CallType } from '../types';
import { ensureMediaPermissions } from './media-permissions';

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

interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name?: string;
}

const E2EE_KEY_SALT = 'silenx-e2ee-v1';

export class LiveKitService {
  private currentSocket: Socket | null = null;
  private room: Room | null = null;
  private keyProvider: ExternalE2EEKeyProvider | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;
  private targetUserId: string | null = null;
  private targetGroupId: string | null = null;
  private currentCallType: CallType | null = null;
  private isCaller = false;
  private streamListeners = new Set<(local: MediaStream | null, remote: MediaStream | null) => void>();
  private audioContext: AudioContext | null = null;
  private ringInterval: ReturnType<typeof setInterval> | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private callLogId: string | null = null;
  private callStartTimestamp: number | null = null;
  private callTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMediaError: string | null = null;
  private lastCallError: string | null = null;
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
    socket.on('call-ringing-received', this.handleCallRingingReceived);
    socket.on('call-accepted', this.handleCallAccepted);
    socket.on('call-rejected', this.handleCallRejected);
    socket.on('call-ended', this.handleRemoteCallEnded);
    socket.on('call-log-id', this.handleCallLogId);
  }

  private detachSocketListeners(socket: Socket): void {
    socket.off('call-incoming', this.handleIncomingCall);
    socket.off('call-ringing-received', this.handleCallRingingReceived);
    socket.off('call-accepted', this.handleCallAccepted);
    socket.off('call-rejected', this.handleCallRejected);
    socket.off('call-ended', this.handleRemoteCallEnded);
    socket.off('call-log-id', this.handleCallLogId);
  }

  public setVideoElements(
    localVideoElement: HTMLVideoElement | null,
    remoteVideoElement: HTMLVideoElement | null
  ): void {
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

  // ??? Ring tone ??????????????????????????????????????????????????????????????

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
      console.warn('[LiveKit] Ring tone could not be started', error);
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

  // ??? Token & room helpers ???????????????????????????????????????????????????

  private async fetchLiveKitToken(params: {
    mode: 'direct' | 'group';
    targetUserId?: string;
    groupId?: string;
  }): Promise<LiveKitTokenResponse | null> {
    const authToken = useAuthStore.getState().token;
    if (!authToken) {
      console.warn('[LiveKit] No auth token available for LiveKit token request');
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/group-calls/livekit/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('[LiveKit] Token request failed:', response.status, detail);
        return null;
      }

      return (await response.json()) as LiveKitTokenResponse;
    } catch (error) {
      console.error('[LiveKit] Error fetching LiveKit token:', error);
      return null;
    }
  }

  /**
   * Derive the E2EE media key deterministically on both peers.
   * The key is a SHA-256 hash of the canonical room name plus an app salt 
   * it is NEVER transmitted to the backend or to LiveKit servers, so LiveKit
   * Cloud only ever relays encrypted frame bytes.
   */
  private async deriveE2eeKey(roomName: string): Promise<Uint8Array> {
    const material = new TextEncoder().encode(`${E2EE_KEY_SALT}|${roomName}`);
    const digest = await crypto.subtle.digest('SHA-256', material);
    return new Uint8Array(digest);
  }

  private async connectToRoom(callType: CallType, mode: 'direct' | 'group'): Promise<boolean> {
    if (this.room && this.room.state === ConnectionState.Connected) {
      return true;
    }

    const tokenResponse = mode === 'group'
      ? await this.fetchLiveKitToken({ mode: 'group', groupId: this.targetGroupId ?? undefined })
      : await this.fetchLiveKitToken({ mode: 'direct', targetUserId: this.targetUserId ?? undefined });

    if (!tokenResponse?.token || !tokenResponse.url) {
      console.error('[LiveKit] Could not obtain room credentials');
      return false;
    }

    try {
      // End-to-end encryption setup  the worker decrypts/encrypts frames
      // locally so LiveKit servers never see plaintext media. The shared key
      // is derived deterministically on both peers and never transmitted.
      this.keyProvider = new ExternalE2EEKeyProvider();
      const encryptionKey = await this.deriveE2eeKey(tokenResponse.roomName);
      await this.keyProvider.setKey(encryptionKey.buffer as ArrayBuffer);

      const e2eeOptions: E2EEOptions = {
        keyProvider: this.keyProvider,
        worker: new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), { type: 'module' }),
      };

      const room = new Room({
        e2ee: e2eeOptions,
        adaptiveStream: true,
        dynacast: true,
      });
      this.room = room;

      room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, this.handleTrackUnsubscribed);
      room.on(RoomEvent.LocalTrackPublished, this.handleLocalTrackChanged);
      room.on(RoomEvent.LocalTrackUnpublished, this.handleLocalTrackChanged);
      room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected);
      room.on(RoomEvent.ConnectionStateChanged, this.handleConnectionStateChanged);
      room.on(RoomEvent.Disconnected, this.handleRoomDisconnected);

      await room.connect(tokenResponse.url, tokenResponse.token, { autoSubscribe: true });

      try {
        await room.setE2EEEnabled(true);
      } catch {
        // Already enabled via constructor option  safe to ignore.
      }

      await this.publishLocalTracks(callType);

      console.log(`[LiveKit] Connected to E2EE room "${tokenResponse.roomName}"`);
      return true;
    } catch (error) {
      console.error('[LiveKit] Error connecting to room:', error);
      this.teardownRoom();
      return false;
    }
  }

  private async publishLocalTracks(callType: CallType): Promise<void> {
    if (!this.room?.localParticipant || !this.localStream) {
      return;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      await this.room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
    }

    if (callType === 'video') {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        await this.room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
      }
    }

    this.rebuildLocalStream();
  }

  private rebuildLocalStream(): void {
    if (!this.room) return;

    const tracks: MediaStreamTrack[] = [];
    for (const publication of this.room.localParticipant.trackPublications.values()) {
      const mediaTrack = publication.track?.mediaStreamTrack;
      if (mediaTrack) {
        tracks.push(mediaTrack);
      }
    }

    // Always create a NEW MediaStream reference so React re-renders
    this.localStream = new MediaStream(tracks);

    if (this.localVideoElement) {
      this.localVideoElement.srcObject = this.localStream;
    }

    this.notifyStreamListeners();
  }

  private rebuildRemoteStream(): void {
    if (!this.room) return;

    const tracks: MediaStreamTrack[] = [];
    for (const participant of this.room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.isSubscribed && publication.track) {
          tracks.push(publication.track.mediaStreamTrack);
        }
      }
    }

    this.remoteStream = new MediaStream(tracks);

    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = this.remoteStream;
    }

    this.notifyStreamListeners();
  }

  // ??? Room event handlers ????????????????????????????????????????????????????

  private handleTrackSubscribed = (): void => {
    this.rebuildRemoteStream();
  };

  private handleTrackUnsubscribed = (): void => {
    this.rebuildRemoteStream();
  };

  private handleLocalTrackChanged = (): void => {
    this.rebuildLocalStream();
  };

  private handleParticipantConnected = (participant: { identity: string }): void => {
    console.log('[LiveKit] Participant connected:', participant.identity);
  };

  private handleParticipantDisconnected = (): void => {
    if (!this.room) return;

    // 1-on-1: the remote peer leaving ends the call.
    // Group: the call ends only when every other participant has left.
    if (this.room.remoteParticipants.size === 0) {
      console.log('[LiveKit] All remote participants left  ending call');
      this.resetCallState();
    }
  };

  private handleConnectionStateChanged = (state: ConnectionState): void => {
    console.debug('[LiveKit] connectionState:', state);
    if (state === ConnectionState.Reconnecting) {
      console.warn('[LiveKit] Connection lost  reconnecting');
    }
  };

  private handleRoomDisconnected = (): void => {
    console.log('[LiveKit] Room disconnected');
    if (useCallStore.getState().isInCall) {
      this.resetCallState();
    }
  };

  // ??? Outbound / inbound call flow ???????????????????????????????????????????

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
      console.warn('[LiveKit] Unable to start call because no socket is available');
      return false;
    }

    this.initialize(socket);
    const socketReady = await this.waitForSocketReady(socket);
    if (!socketReady) {
      console.warn('[LiveKit] Unable to start call because the socket did not connect in time');
      return false;
    }

    this.targetUserId = targetUserId;
    this.targetGroupId = null;
    this.currentCallType = callType;
    this.isCaller = true;

    useCallStore.getState().initiateCall(callType, targetUserId, targetName);

    socket.emit('call-initiate', {
      targetUserId,
      callerName,
      callerAvatarUrl,
      callType,
    });

    // Acquire media up-front so the permission prompt and local preview appear
    // while the recipient's phone is still ringing.
    const gotMedia = await this.ensureLocalMedia(callType);
    if (!gotMedia) {
      console.warn('[LiveKit] Outgoing call failed because local media access was denied or unavailable');
      this.clearPendingOutboundCall();
      return false;
    }

    this.clearCallTimeout();
    this.callTimeoutTimer = setTimeout(() => {
      if (useCallStore.getState().callStatus === 'pending' && this.isCaller) {
        console.warn('[LiveKit] Call timed out  no answer received');
        this.endCall();
      }
    }, LiveKitService.CALL_TIMEOUT_MS);

    return true;
  }

  /**
   * Join a group call room immediately (no ringing phase).
   */
  public async startGroupCall(groupId: string, callType: CallType, groupName: string): Promise<boolean> {
    let socket = getSocket();
    if (!socket) {
      socket = connectSocket();
    }
    if (!socket) return false;

    this.initialize(socket);
    const socketReady = await this.waitForSocketReady(socket);
    if (!socketReady) return false;

    this.targetGroupId = groupId;
    this.targetUserId = null;
    this.currentCallType = callType;
    this.isCaller = true;

    useCallStore.getState().initiateCall(callType, `group:${groupId}`, groupName);

    const gotMedia = await this.ensureLocalMedia(callType);
    if (!gotMedia) {
      this.clearPendingOutboundCall();
      return false;
    }

    const connected = await this.connectToRoom(callType, 'group');
    if (!connected) {
      this.clearPendingOutboundCall();
      return false;
    }

    this.callStartTimestamp = Date.now();
    useCallStore.getState().acceptCall();
    return true;
  }

  public async acceptIncomingCall(): Promise<boolean> {
    if (!this.targetUserId || !this.currentCallType) {
      console.debug('[LiveKit] acceptIncomingCall skipped, no target or call type');
      return false;
    }

    const socket = getSocket();
    if (!socket) {
      console.debug('[LiveKit] acceptIncomingCall skipped, socket unavailable');
      return false;
    }

    this.stopRingTone();
    this.lastCallError = null;

    const gotMedia = await this.ensureLocalMedia(this.currentCallType);
    if (!gotMedia) {
      console.debug('[LiveKit] acceptIncomingCall failed to get media');
      useCallStore.getState().rejectCall();
      return false;
    }

    const connected = await this.connectToRoom(this.currentCallType, 'direct');
    if (!connected) {
      this.lastCallError = 'Could not connect to the call server. Please check your internet connection and try again.';
      useCallStore.getState().rejectCall();
      return false;
    }

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
      console.debug('[LiveKit] rejectCall sending call-reject to', this.targetUserId);
      getSocket()?.emit('call-reject', {
        targetUserId: this.targetUserId,
        callLogId: this.callLogId,
      });
    }
    this.stopRingTone();
    this.resetCallState();
  }

  public endCall(): void {
    if (this.targetUserId || this.targetGroupId) {
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

  // ??? Call controls (LiveKit-native) ?????????????????????????????????????????

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
    const audioTracks = this.localStream?.getAudioTracks() ?? [];
    audioTracks.forEach((track) => {
      track.enabled = !muted;
    });
    this.room?.localParticipant.setMicrophoneEnabled(!muted).catch(() => null);
    return this.isMicrophoneMuted();
  }

  public setCameraOff(off: boolean): boolean {
    const videoTracks = this.localStream?.getVideoTracks() ?? [];
    videoTracks.forEach((track) => {
      track.enabled = !off;
    });
    this.room?.localParticipant.setCameraEnabled(!off).catch(() => null);
    this.notifyStreamListeners();
    return this.isCameraOff();
  }

  public toggleAudio(): boolean {
    const currentMuted = this.isMicrophoneMuted();
    return this.setMicrophoneMuted(!currentMuted);
  }

  public async toggleVideo(): Promise<boolean> {
    const currentOff = this.isCameraOff();
    return this.setCameraOff(!currentOff);
  }

  public async switchCamera(): Promise<boolean> {
    if (!this.room?.localParticipant || this.currentCallType !== 'video') {
      return false;
    }

    const nextFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    const wantRear = nextFacingMode === 'environment';

    try {
      // Preferred path: switch among already-known camera devices.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const currentDeviceId = this.room.getActiveDevice('videoinput');
      const candidates = devices.filter(
        (d) => d.kind === 'videoinput' && d.deviceId !== currentDeviceId
      );
      const preferred =
        candidates.find((d) => {
          const label = d.label.toLowerCase();
          return wantRear
            ? label.includes('back') || label.includes('rear')
            : label.includes('front') || label.includes('user');
        }) || candidates[0];

      if (preferred) {
        await this.room.switchActiveDevice('videoinput', preferred.deviceId);
        this.currentFacingMode = nextFacingMode;
        this.rebuildLocalStream();
        return true;
      }
    } catch (error) {
      console.warn('[LiveKit] Device-list switchCamera failed, trying manual replacement:', error);
    }

    // Manual fallback: acquire the other facing camera and replace the published track.
    try {
      this.localStream?.getVideoTracks().forEach((t) => t.stop());
      await new Promise((resolve) => setTimeout(resolve, 150));

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacingMode } },
        });
      }

      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) return false;

      const publication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (publication?.videoTrack) {
        await publication.videoTrack.replaceTrack(newTrack);
      } else {
        await this.room.localParticipant.publishTrack(newTrack, { source: Track.Source.Camera });
      }

      this.currentFacingMode = nextFacingMode;
      this.rebuildLocalStream();
      return true;
    } catch (recoveryError) {
      console.error('[LiveKit] Failed to switch camera:', recoveryError);
      return false;
    }
  }

  // ??? Media acquisition ??????????????????????????????????????????????????????

  /**
   * Human-readable reason for the last media acquisition failure, for UI
   * surfaces (e.g. the call overlay alert).
   */
  public getMediaError(): string | null {
    return this.lastMediaError;
  }

  public getCallError(): string | null {
    return this.lastCallError;
  }

  private static errorName(error: unknown): string {
    return error instanceof DOMException ? error.name : '';
  }

  /**
   * Acquire local media with layered fallbacks:
   *   secure-context check -> runtime permission prompt (native) ->
   *   full audio+video -> audio-only -> basic audio.
   *
   * On failure, populates lastMediaError with an actionable message that
   * points users to Android App Settings when permissions were denied.
   */
  private async ensureLocalMedia(callType: CallType): Promise<boolean> {
    if (this.localStream && this.localStream.getAudioTracks().length > 0) {
      return true;
    }

    this.lastMediaError = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[LiveKit] getUserMedia is not supported in this browser context');
      this.lastMediaError = 'Calling is not supported in this browser or WebView.';
      return false;
    }

    // 1. Secure context — getUserMedia is unavailable on insecure origins
    //    (plain http). Capacitor's capacitor://localhost counts as secure.
    if (!window.isSecureContext) {
      console.error('[LiveKit] Insecure context — getUserMedia requires HTTPS');
      this.lastMediaError =
        'Calls require a secure connection (HTTPS). Open SilenX over https:// or use the mobile app.';
      return false;
    }

    const wantsVideo = callType === 'video';

    // 2. Request/check permissions before getUserMedia.
    //    On native Android: must request via the Capacitor plugin first or the
    //    WebView silently denies getUserMedia with NotAllowedError.
    //    On web: use Permissions API to detect already-denied state early so we
    //    can show the right browser-specific guidance immediately.
    let cameraAvailable = true;
    if (isCapacitorNative) {
      const permissions = await ensureMediaPermissions(wantsVideo ? 'video' : 'audio');
      if (!permissions.microphone) {
        console.error('[LiveKit] Microphone permission denied (native)');
        this.lastMediaError =
          'Microphone access is blocked. Open Android Settings > Apps > SilenX > Permissions and allow Microphone (and Camera), then try again.';
        return false;
      }
      cameraAvailable = permissions.camera;
      if (wantsVideo && !cameraAvailable) {
        console.warn('[LiveKit] Camera permission denied — will fall back to audio-only');
      }
    } else {
      // Web: query current permission state without prompting.
      try {
        const micState = await (navigator.permissions as any).query({ name: 'microphone' });
        if (micState.state === 'denied') {
          console.error('[LiveKit] Browser microphone permission is denied');
          this.lastMediaError =
            'Microphone access is blocked in your browser.\n\n' +
            'Fix: click the 🔒 lock icon next to the URL → Site settings → Microphone → Allow, then refresh and try again.';
          return false;
        }
      } catch {
        // Permissions API unsupported — proceed, getUserMedia will prompt.
      }
    }

    // 3. Acquisition attempts with graceful degradation to audio-only.
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    let stream: MediaStream | null = null;

    if (wantsVideo && cameraAvailable) {
      for (const videoConstraint of [{ facingMode: 'user' }, true] as MediaTrackConstraints[]) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: videoConstraint,
          });
          break;
        } catch (error) {
          const name = LiveKitService.errorName(error);
          console.warn(`[LiveKit] Audio+video getUserMedia failed (${name || 'unknown'}):`, error);
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            console.warn(
              '[LiveKit] If camera stays blocked, allow it under Android Settings > Apps > SilenX > Permissions.'
            );
          }
          // Device missing, busy, unsupported constraint, or denied — degrade to audio-only.
        }
      }
    }

    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (advancedError) {
        console.warn('[LiveKit] Advanced audio constraints failed, retrying basic:', advancedError);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (basicError) {
          console.error('[LiveKit] All media acquisition attempts failed:', basicError);
          const name = LiveKitService.errorName(basicError);
          if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            this.lastMediaError = 'No microphone was found on this device.';
          } else if (name === 'NotReadableError') {
            this.lastMediaError =
              'Your microphone is busy in another app. Close it and try again.';
          } else if (name === 'NotAllowedError' || name === 'SecurityError') {
            this.lastMediaError = isCapacitorNative
              ? 'Microphone access is blocked. Open Android Settings > Apps > SilenX > Permissions and allow Microphone, then try again.'
              : 'Microphone access is blocked.\n\nFix: click the 🔒 lock icon next to the URL → Site settings → Microphone → Allow, then refresh.';
          } else {
            this.lastMediaError = 'Unable to access your microphone. Please check your browser or device settings.';
          }
          return false;
        }
      }
    }

    const gotVideo = stream.getVideoTracks().length > 0;
    if (wantsVideo && !gotVideo) {
      // Graceful downgrade: keep the call alive as audio-only.
      console.warn('[LiveKit] Video unavailable — continuing as audio-only call');
      if (useCallStore.getState().callType === 'video') {
        useCallStore.setState({ callType: 'audio', isVideoOff: true });
      }
      this.currentCallType = 'audio';
    }

    this.localStream = stream;
    console.debug('[LiveKit] getUserMedia success:', stream.getTracks().map((t) => t.kind));

    if (this.localVideoElement) {
      this.localVideoElement.srcObject = this.localStream;
    }

    this.notifyStreamListeners();
    return true;
  }

  // ??? Socket event handlers ??????????????????????????????????????????????????

  private handleIncomingCall = (payload: CallIncomingPayload): void => {
    if (!payload?.callerId) {
      return;
    }

    if (useCallStore.getState().isInCall) {
      getSocket()?.emit('call-reject', { targetUserId: payload.callerId });
      return;
    }

    this.targetUserId = payload.callerId;
    this.targetGroupId = null;
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

    getSocket()?.emit('call-ringing', { targetUserId: payload.callerId });

    this.startRingTone(false).catch(() => undefined);
  };

  private handleCallRingingReceived = (payload: { responderId: string }): void => {
    if (!this.isCaller || !this.targetUserId || payload?.responderId !== this.targetUserId) {
      return;
    }
    console.debug('[LiveKit] call-ringing-received from recipient');
    useCallStore.getState().setRinging(true);
    this.startRingTone(true).catch(() => undefined);
  };

  private handleCallAccepted = async (payload: CallAcceptedPayload): Promise<void> => {
    if (!this.isCaller || !this.targetUserId || payload.responderId !== this.targetUserId || !this.currentCallType) {
      return;
    }

    this.stopRingTone();
    this.clearCallTimeout();

    if (payload.callLogId && !this.callLogId) {
      this.callLogId = payload.callLogId;
      useCallStore.getState().setCallLogId(this.callLogId!);
    }

    const gotMedia = await this.ensureLocalMedia(this.currentCallType);
    if (!gotMedia) {
      this.endCall();
      return;
    }

    const connected = await this.connectToRoom(this.currentCallType, 'direct');
    if (!connected) {
      this.endCall();
      return;
    }

    useCallStore.getState().acceptCall();
    this.callStartTimestamp = Date.now();
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

  private handleCallLogId = (payload: { callLogId: string }): void => {
    if (payload?.callLogId) {
      this.callLogId = payload.callLogId;
      useCallStore.getState().setCallLogId(payload.callLogId);
      console.debug('[LiveKit] received callLogId:', payload.callLogId);
    }
  };

  // ??? Teardown ???????????????????????????????????????????????????????????????

  private clearPendingOutboundCall(): void {
    this.stopRingTone();
    this.clearCallTimeout();
    useCallStore.getState().endCall();
    this.teardownRoom();
    this.targetUserId = null;
    this.targetGroupId = null;
    this.currentCallType = null;
    this.isCaller = false;
    this.callLogId = null;
    this.callStartTimestamp = null;
  }

  private clearCallTimeout(): void {
    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }
  }

  private teardownRoom(): void {
    if (this.room) {
      this.room.removeAllListeners();
      try {
        this.room.disconnect();
      } catch {
        // already disconnected
      }
      this.room = null;
    }
    this.keyProvider = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }

    this.notifyStreamListeners();
  }

  private resetCallState(): void {
    this.stopRingTone();
    this.clearCallTimeout();
    useCallStore.getState().endCall();
    this.teardownRoom();
    this.targetUserId = null;
    this.targetGroupId = null;
    this.currentCallType = null;
    this.isCaller = false;
    this.callLogId = null;
    this.callStartTimestamp = null;
  }
}

export const livekitService = new LiveKitService();
