import React from 'react';
import { X } from 'lucide-react';
import './UserPreviewModal.css';

interface UserPreviewProps {
  user: {
    name: string;
    avatar: string;
    status: string;
  };
  onClose: () => void;
  onAdd: () => void;
}

const UserPreviewModal: React.FC<UserPreviewProps> = ({ user, onClose, onAdd }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content user-preview-modal">
        <button className="modal-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <div className="preview-avatar">{user.avatar}</div>
        <h2>{user.name}</h2>
        <p className={`preview-status ${user.status.toLowerCase()}`}>
          ● {user.status}
        </p>
        <div className="preview-actions">
          <button className="btn" style={{ background: 'var(--bg-tertiary)' }} onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPreviewModal;
