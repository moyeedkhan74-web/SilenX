import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
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

export const UserPreviewModal: React.FC<UserPreviewProps> = ({ user, onClose, onAdd }) => {
  return (
    <Modal isOpen={true} onClose={onClose} className="user-preview-modal" title="User Found">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
        <div className="preview-avatar" style={{ margin: 0 }}>{user.avatar}</div>
        <h2 style={{ margin: 0, fontSize: '20px' }}>{user.name}</h2>
        <p className={`preview-status ${user.status.toLowerCase()}`} style={{ margin: 0 }}>
          ● {user.status}
        </p>
        <div className="preview-actions" style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px' }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
            Close
          </Button>
          <Button variant="primary" onClick={onAdd} style={{ flex: 1 }}>
            Send Request
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UserPreviewModal;
