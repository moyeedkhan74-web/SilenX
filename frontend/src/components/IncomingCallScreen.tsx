import React from 'react';
import { Avatar } from './Avatar';
import { Phone, Video, X } from 'lucide-react';
import type { CallType } from '../types';
import './IncomingCallScreen.css';

interface IncomingCallScreenProps {
  callerName: string | null;
  callerAvatarUrl: string | null;
  callType: CallType | null;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  callerName,
  callerAvatarUrl,
  callType,
  onAccept,
  onReject,
}) => {
  const title = callType === 'video' ? 'Video Call' : 'Audio Call';
  const incomingText = `Incoming ${title.toLowerCase()}…`;
  const displayName = callerName || 'Unknown caller';

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
            {callType === 'video' && (
              <div className="incoming-call-type-badge" aria-hidden="true">
                <Video size={14} />
              </div>
            )}
          </div>
        </div>

        <div className="incoming-call-copy">
          <span className="incoming-call-label">{title}</span>
          <h2 id="incoming-call-title">{displayName}</h2>
          <p id="incoming-call-subtitle" className="incoming-call-subtitle">{incomingText}</p>
        </div>

        <div className="incoming-call-actions">
          <button
            type="button"
            className="incoming-call-action incoming-call-action--decline"
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
        </div>
      </div>
    </div>
  );
};

export default IncomingCallScreen;
