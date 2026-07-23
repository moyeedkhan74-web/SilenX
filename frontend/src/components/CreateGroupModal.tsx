import React, { useMemo, useState } from 'react';
import { Users, Check, UserPlus, X } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import AvatarDisplay from './shared/AvatarDisplay';
import { useChatStore } from '../store/chatStore';
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

    const result = await createGroup({
      name: groupName.trim(),
      description: description.trim(),
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
    setSelectedIds([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="create-group-modal" title="Create Group">
      <div className="create-group-body">
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
