import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import UIDDisplay from './shared/UIDDisplay';
import QRCodeSection from './shared/QRCodeSection';
import './UIDShareModal.css';

interface UIDShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
}

export const UIDShareModal: React.FC<UIDShareModalProps> = ({ isOpen, onClose, uid }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="uid-share-modal" title="Your Secure ID">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
        <QRCodeSection uid={uid} size={250} />
        <div style={{ width: '100%' }}>
          <UIDDisplay uid={uid} isLoading={uid === 'Loading...'} />
        </div>
        <Button variant="secondary" onClick={onClose} style={{ width: '100%' }}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default UIDShareModal;
