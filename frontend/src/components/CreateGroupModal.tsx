import React, { useMemo, useState } from 'react';
import { Users, Check, UserPlus, X, Image as ImageIcon } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import AvatarDisplay from './shared/AvatarDisplay';
import { useChatStore } from '../store/chatStore';
import { uploadToBackblaze } from '../services/backblaze';
import './CreateGroupModal.css';

interface GroupMemberOption {
  id: string;
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  status?: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  contacts: GroupMemberOption[];
  onClose: () => void;
  onCreateSuccess?: (conversationId: string) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  contacts,
  onClose,
  onCreateSuccess,
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const createGroup = useChatStore((state) => state.createGroup);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.includes(contact.id)),
    [contacts, selectedIds]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFileSelect = (f: File) => {
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Please enter a group name.');
      return;
    }

    if (selectedIds.length === 0) {
      setError('Select at least one secure contact to add to the group.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    let finalAvatarUrl = avatarUrl.trim();
    if (avatarFile) {
      try {
        const uploaded = await uploadToBackblaze(avatarFile, 'group-avatars');
        finalAvatarUrl = uploaded.url;
      } catch (err) {
        console.error('Group avatar upload failed:', err);
        setError('Failed to upload group profile picture.');
        setIsSubmitting(false);
        return;
      }
    }

    const result = await createGroup({
      name: groupName.trim(),
      description: description.trim(),
      avatarUrl: finalAvatarUrl || undefined,
      members: selectedIds,
    });

    setIsSubmitting(false);

    if (!result?.id) {
      setError('Group creation failed. Please try again.');
      return;
    }

    onCreateSuccess?.(result.id);
    setGroupName('');
    setDescription('');
    setAvatarUrl('');
    setAvatarFile(null);
    setSelectedIds([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="create-group-modal" title="Create Group">
      <div className="create-group-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <AvatarDisplay name={groupName || 'Group'} avatarUrl={avatarUrl || null} size={64} />
          <div style={{ flex: 1 }}>
            <label htmlFor="group-avatar" style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Group Profile Picture (optional)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label className="btn-icon-inline" style={{ cursor: 'pointer', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} />
                <span>Upload</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
              </label>
              <input
                type="text"
                placeholder="Or paste image URL"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        <div className="create-group-field">
          <label htmlFor="group-name">Group name</label>
          <input
            id="group-name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Product Team"
            maxLength={40}
          />
        </div>

        <div className="create-group-field">
          <label htmlFor="group-description">Description</label>
          <textarea
            id="group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional group topic or purpose"
            rows={3}
            maxLength={160}
          />
        </div>

        <div className="create-group-selection">
          <div className="create-group-selection-header">
            <div>
              <h3>Choose members</h3>
              <span>{selectedIds.length} selected</span>
            </div>
            <Users size={16} />
          </div>

          <div className="create-group-contact-list">
            {contacts.length === 0 ? (
              <div className="create-group-empty-state">
                <UserPlus size={18} />
                <span>No secure contacts yet.</span>
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selectedIds.includes(contact.id);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`create-group-contact-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelect(contact.id)}
                  >
                    <div className="contact-item-left">
                      <AvatarDisplay
                        name={contact.displayName}
                        avatarUrl={contact.avatarUrl || null}
                        size={40}
                        status={contact.status}
                      />
                      <div className="contact-item-copy">
                        <strong>{contact.displayName}</strong>
                        <code>{contact.uid}</code>
                      </div>
                    </div>
                    <span className="contact-select-badge">
                      {isSelected ? <Check size={14} /> : <span className="contact-select-dot" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selectedContacts.length > 0 && (
          <div className="create-group-selected-summary">
            <span>Inviting:</span>
            <div className="create-group-selected-tags">
              {selectedContacts.map((contact) => (
                <span key={contact.id} className="create-group-tag">
                  {contact.displayName}
                  <button type="button" onClick={() => toggleSelect(contact.id)} aria-label={`Remove ${contact.displayName}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="create-group-error">{error}</p>}

        <div className="create-group-actions">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
