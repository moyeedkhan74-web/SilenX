import { Socket } from 'socket.io-client';
import { WEBRTC_CONFIG } from '../config/webrtc-config';

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;
  
  private socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  public async getUserMedia(localVideoRef: HTMLVideoElement, remoteVideoRef: HTMLVideoElement): Promise<boolean> {
    try {
      this.localVideoElement = localVideoRef;
      this.remoteVideoElement = remoteVideoRef;
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }
      return true;
    } catch (error) {
      console.error('[WebRTC] Error accessing media devices:', error);
      return false;
    }
  }

  public createPeerConnection() {
    try {
      this.peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);

      // Add local stream tracks to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.localStream && this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // In a real app we'd target a specific ID
          this.socket.emit('ice-candidate', { targetId: '', candidate: event.candidate });
        }
      };

      // Handle receiving tracks
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
    }
  }

  public async createOffer(targetId: string) {
    try {
      if (!this.peerConnection) return;
      
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('sdp-offer', { targetId, sdp: offer, callerId: this.socket.id });
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
    }
  }

  public async createAnswer(offerSdp: any, callerId: string) {
    try {
      this.createPeerConnection();
      if (!this.peerConnection) return;
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.socket.emit('sdp-answer', { targetId: callerId, sdp: answer, responderId: this.socket.id });
    } catch (error) {
      console.error('[WebRTC] Error creating answer:', error);
    }
  }

  public async handleRemoteAnswer(answerSdp: any) {
    try {
      if (!this.peerConnection) return;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
    } catch (error) {
      console.error('[WebRTC] Error handling remote answer:', error);
    }
  }

  public async addIceCandidate(candidate: any) {
    try {
      if (!this.peerConnection) return;
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }

  public toggleAudio(mute: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  }

  public toggleVideo(off: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !off;
      });
    }
  }

  public stopCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localVideoElement) this.localVideoElement.srcObject = null;
    if (this.remoteVideoElement) this.remoteVideoElement.srcObject = null;
  }
}
