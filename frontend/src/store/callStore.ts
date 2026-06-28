import { create } from 'zustand';
import type { CallType, CallStatus } from '../types';

interface CallState {
  isInCall: boolean;
  callType: CallType | null;
  callStatus: CallStatus | null;
  callerId: string | null;
  callerName: string | null;
  duration: number;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  initiateCall: (callType: CallType, targetId: string) => void;
  receiveCall: (callerId: string, callerName: string, callType: CallType) => void;
  acceptCall: () => void;
  rejectCall: () => void;
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
  duration: 0,
  isAudioMuted: false,
  isVideoOff: false,
  initiateCall: (callType, _targetId) =>
    set({ isInCall: true, callType, callStatus: 'pending', duration: 0 }),
  receiveCall: (callerId, callerName, callType) =>
    set({ isInCall: true, callType, callStatus: 'pending', callerId, callerName }),
  acceptCall: () => set({ callStatus: 'accepted', duration: 0 }),
  rejectCall: () =>
    set({ isInCall: false, callType: null, callStatus: null, callerId: null, callerName: null, duration: 0 }),
  endCall: () =>
    set({ isInCall: false, callType: null, callStatus: null, callerId: null, callerName: null, duration: 0, isAudioMuted: false, isVideoOff: false }),
  toggleAudio: () => set((s) => ({ isAudioMuted: !s.isAudioMuted })),
  toggleVideo: () => set((s) => ({ isVideoOff: !s.isVideoOff })),
  tick: () => set((s) => ({ duration: s.duration + 1 })),
}));
