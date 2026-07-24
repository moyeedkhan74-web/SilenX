import { create } from 'zustand';
import type { CallType, CallStatus } from '../types';

interface CallState {
  isInCall: boolean;
  callType: CallType | null;
  callStatus: CallStatus | null;
  callerId: string | null;
  callerName: string | null;
  callerAvatarUrl: string | null;
  callLogId: string | null;
  isCaller: boolean;
  duration: number;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  setCallLogId: (id: string) => void;
  initiateCall: (callType: CallType, targetId: string, targetName: string) => void;
  receiveCall: (callerId: string, callerName: string, callerAvatarUrl: string | null, callType: CallType, callLogId?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  tick: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  isInCall: false,
  callType: null,
  callStatus: null,
  callerId: null,
  callerName: null,
  callerAvatarUrl: null,
  callLogId: null,
  isCaller: false,
  duration: 0,
  isAudioMuted: false,
  isVideoOff: false,
  setCallLogId: (id: string) => set({ callLogId: id }),
  initiateCall: (callType, targetId, targetName) =>
    set({
      isInCall: true,
      callType,
      callStatus: 'pending',
      callerId: targetId,
      callerName: targetName,
      callerAvatarUrl: null,
      callLogId: null,
      isCaller: true,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    }),
  receiveCall: (callerId, callerName, callerAvatarUrl, callType, callLogId) =>
    set({
      isInCall: true,
      callType,
      callStatus: 'pending',
      callerId,
      callerName,
      callerAvatarUrl,
      callLogId: callLogId || null,
      isCaller: false,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    }),
  acceptCall: () => set({ callStatus: 'active', duration: 0 }),
  rejectCall: () =>
    set({
      isInCall: false,
      callType: null,
      callStatus: null,
      callerId: null,
      callerName: null,
      callerAvatarUrl: null,
      callLogId: null,
      isCaller: false,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    }),
  declineCall: () =>
    set({
      isInCall: false,
      callType: null,
      callStatus: null,
      callerId: null,
      callerName: null,
      callerAvatarUrl: null,
      callLogId: null,
      isCaller: false,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    }),
  endCall: () =>
    set({
      isInCall: false,
      callType: null,
      callStatus: null,
      callerId: null,
      callerName: null,
      callerAvatarUrl: null,
      callLogId: null,
      isCaller: false,
      duration: 0,
      isAudioMuted: false,
      isVideoOff: false,
    }),
  toggleAudio: () => set((s) => ({ isAudioMuted: !s.isAudioMuted })),
  toggleVideo: () => set((s) => ({ isVideoOff: !s.isVideoOff })),
  tick: () => set((s) => ({ duration: s.duration + 1 })),
}));
