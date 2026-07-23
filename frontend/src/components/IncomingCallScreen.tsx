import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { Phone, PhoneOff, Video, Mic, X } from 'lucide-react';
import type { CallType } from '../types';
import './IncomingCallScreen.css';

interface IncomingCallScreenProps {
  callerName: string | null;
  callerAvatarUrl: string | null;
  callType: CallType | null;
  isCaller: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  callerName,
  callerAvatarUrl,
  callType,
  isCaller,
  onAccept,
  onReject,
  onCancel,
}) => {
  const title = callType === 'video' ? 'Video call' : 'Audio call';
  const displayName = callerName || 'Unknown caller';
  const statusText = isCaller ? 'Calling…' : `Incoming ${title.toLowerCase()}…`;
  const subtitle = isCaller
    ? 'Waiting for them to answer. You can cancel anytime.'
    : 'Accept or decline the call before it ends.';
  const icon = callType === 'video' ? <Video size={16} /> : <Mic size={16} />;

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const [toneBlocked, setToneBlocked] = useState(false);

  useEffect(() => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const tryStartTone = async () => {
      try {
        const ctx = new AudioContextCtor();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.value = isCaller ? 480 : 420;
        gain.gain.value = 0.08;

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start();
        await ctx.resume();

        audioContextRef.current = ctx;
        oscillatorRef.current = oscillator;
      } catch (error) {
        console.warn('[IncomingCallScreen] ringtone blocked or unavailable', error);
        setToneBlocked(true);
      }
    };

    tryStartTone();

    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => null);
      }
      audioContextRef.current = null;
      oscillatorRef.current = null;
    };
  }, [isCaller]);

  return (
    <div className="incoming-call-screen" role="alertdialog" aria-labelledby="incoming-call-title" aria-describedby="incoming-call-subtitle">
      <div className="incoming-call-panel">
        <div className="incoming-call-glow" />
        <div className="incoming-ring-group">
          <div className="incoming-ring incoming-ring-1" />
          <div className="incoming-ring incoming-ring-2" />
          <div className="incoming-ring incoming-ring-3" />
          <div className="incoming-avatar-frame">
            <Avatar name={displayName} size={120} avatarUrl={callerAvatarUrl || undefined} />
            <div className="incoming-call-type-badge" aria-hidden="true">
              {icon}
            </div>
          </div>
        </div>

        <div className="incoming-call-copy">
          <span className="incoming-call-label">{title}</span>
          <h2 id="incoming-call-title">{displayName}</h2>
          <p id="incoming-call-subtitle" className="incoming-call-subtitle">{statusText}</p>
          <p className="incoming-call-note">{subtitle}</p>
          {toneBlocked && !isCaller && (
            <p className="incoming-call-note incoming-call-note--warn">
              Sound playback is blocked in this browser; tap to answer when ready.
            </p>
          )}
        </div>

        <div className="incoming-call-actions">
          {isCaller ? (
            <button
              type="button"
              className="incoming-call-action incoming-call-action--cancel"
              onClick={onCancel}
              aria-label="Cancel call"
            >
              <PhoneOff size={24} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="incoming-call-action incoming-call-action incoming-call-action--decline"
                onClick={onReject}
                aria-label="Reject call"
              >
                <X size={24} />
              </button>
              <button
                type="button"
                className="incoming-call-action incoming-call-action--accept"
                onClick={onAccept}
                aria-label="Accept call"
              >
                <Phone size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomingCallScreen;
