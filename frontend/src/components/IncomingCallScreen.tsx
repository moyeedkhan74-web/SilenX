import React from 'react';
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
  const isVideo = callType === 'video';
  const title = isVideo ? 'Video Call' : 'Voice Call';
  const displayName = callerName || 'Unknown caller';
  const statusText = isCaller ? 'Ringing…' : `Incoming ${title}…`;
  const subtitle = isCaller
    ? 'Waiting for recipient to answer…'
    : 'Tap Accept to answer or Decline to reject.';
  const typeIcon = isVideo ? <Video size={16} /> : <Mic size={16} />;



  return (
    <div className="incoming-call-screen" role="alertdialog" aria-labelledby="call-title" aria-describedby="call-subtitle">
      <div className="incoming-call-backdrop" />
      <div className="incoming-call-panel">
        <div className="incoming-call-glow" />

        {/* Pulsing Avatar Frame */}
        <div className="incoming-ring-group">
          <div className={`incoming-ring incoming-ring-1 ${isCaller ? 'outgoing' : 'incoming'}`} />
          <div className={`incoming-ring incoming-ring-2 ${isCaller ? 'outgoing' : 'incoming'}`} />
          <div className={`incoming-ring incoming-ring-3 ${isCaller ? 'outgoing' : 'incoming'}`} />
          <div className={`incoming-ring incoming-ring-4 ${isCaller ? 'outgoing' : 'incoming'}`} />
          <div className="incoming-avatar-frame">
            <Avatar name={displayName} size={110} avatarUrl={callerAvatarUrl || undefined} />
            <div className="incoming-call-type-badge" aria-hidden="true" title={title}>
              {typeIcon}
            </div>
          </div>
        </div>

        {/* Info & Labels */}
        <div className="incoming-call-copy">
          <div className="incoming-call-badge">
            <span className="incoming-live-dot" />
            <span className="incoming-call-label">{title}</span>
          </div>
          <h2 id="call-title">{displayName}</h2>
          <p id="call-subtitle" className="incoming-call-subtitle">{statusText}</p>
          <p className="incoming-call-note">{subtitle}</p>
        </div>

        {/* Action Controls */}
        <div className="incoming-call-actions">
          {isCaller ? (
            <div className="call-action-wrapper">
              <button
                type="button"
                className="incoming-call-action incoming-call-action--cancel"
                onClick={onCancel}
                aria-label="Cancel call"
                title="Cancel Call"
              >
                <PhoneOff size={26} />
              </button>
              <span className="action-label">Cancel</span>
            </div>
          ) : (
            <>
              <div className="call-action-wrapper">
                <button
                  type="button"
                  className="incoming-call-action incoming-call-action--decline"
                  onClick={onReject}
                  aria-label="Decline call"
                  title="Decline Call"
                >
                  <X size={26} />
                </button>
                <span className="action-label">Decline</span>
              </div>

              <div className="call-action-wrapper">
                <button
                  type="button"
                  className="incoming-call-action incoming-call-action--accept"
                  onClick={onAccept}
                  aria-label="Accept call"
                  title="Accept Call"
                >
                  <Phone size={26} />
                </button>
                <span className="action-label">Accept</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomingCallScreen;
