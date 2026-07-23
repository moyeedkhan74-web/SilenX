import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Camera, Save, Search, VolumeX, Trash2, ImageIcon } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import AvatarDisplay from './shared/AvatarDisplay';
import { Conversation } from '../types';
import { useChatStore } from '../store/chatStore';
import { uploadToBackblaze } from '../services/backblaze';
import './GroupDetailsModal.css';

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  onSearchInChat?: () => void;
}

export const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  isOpen,
  onClose,
  conversation,
  onSearchInChat,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateGroup = useChatStore((state) => state.updateGroup);
  const muteConversation = useChatStore((state) => state.muteConversation);
  const clearConversation = useChatStore((state) => state.clearConversation);

  useEffect(() => {
    if (conversation) {
      setGroupName(conversation.name || '');
      setDescription(conversation.description || '');
      setAvatarUrl(conversation.avatarUrl || '');
      setAvatarFile(null);
      setIsEditing(false);
      setError('');
    }
  }, [conversation, isOpen]);

  if (!conversation) return null;

  const groupId = conversation.groupId || conversation.id.replace('conv_group_', '').replace('conv_', '');

  const handleFileSelect = (f: File) => {
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let finalAvatarUrl = avatarUrl.trim();
      if (avatarFile) {
        try {
          const uploaded = await uploadToBackblaze(avatarFile, 'group-avatars');
          finalAvatarUrl = uploaded.url;
        } catch (uploadErr) {
          console.error(uploadErr);
          setError('Failed to upload image');
          setSaving(false);
          return;
        }
      }

      const success = await updateGroup(groupId, {
        name: groupName.trim(),
        description: description.trim(),
        avatarUrl: finalAvatarUrl || null,
      });

      if (success) {
        setIsEditing(false);
      } else {
        setError('Failed to update group settings');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="group-details-modal">
      <div className="group-details-container">
        <div className="group-details-header">
          <button className="icon-btn-back" title="Back" type="button" onClick={onClose}>
            <ArrowLeft size={20} />
          </button>
          <h2>Group Info</h2>
          {!isEditing && (
            <button
              className="btn-icon-inline"
              title="Edit Group Details & PFP"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={18} />
            </button>
          )}
        </div>

        <div className="group-details-body">
          <div className="group-hero-card">
            <div className="group-avatar-wrapper">
              <AvatarDisplay
                name={isEditing ? groupName : (conversation.name || 'Group')}
                avatarUrl={isEditing ? avatarUrl : (conversation.avatarUrl || null)}
                size={90}
              />
              {isEditing && (
                <label className="group-avatar-edit-overlay" title="Change Group PFP">
                  <Camera size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  />
                </label>
              )}
            </div>

            {!isEditing ? (
              <>
                <h3 className="group-name">{conversation.name || 'Group Chat'}</h3>
                {conversation.description && (
                  <p className="group-description">{conversation.description}</p>
                )}
                <span className="group-members-count">
                  {conversation.members.length} participants
                </span>
              </>
            ) : (
              <div className="group-edit-form">
                {error && <div style={{ color: 'var(--color-error, #ef4444)', fontSize: '13px' }}>{error}</div>}
                
                <div>
                  <label>Group PFP (Image File or URL)</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <label className="btn-icon-inline" style={{ cursor: 'pointer', padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={16} />
                      <span>Upload</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
                    </label>
                    <input
                      type="text"
                      placeholder="Or paste image URL"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label>Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                  />
                </div>

                <div>
                  <label>Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Group description"
                  />
                </div>

                <div className="group-edit-actions">
                  <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : <><Save size={14} /> Save</>}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="contact-section-card">
            <div className="section-label">Members ({conversation.members.length})</div>
            <div className="group-members-list">
              {conversation.members.map((member) => (
                <div key={member.id} className="group-member-item">
                  <AvatarDisplay
                    name={member.displayName}
                    avatarUrl={member.avatarUrl}
                    size={36}
                    status={member.status}
                  />
                  <div className="group-member-info">
                    <div className="group-member-name">{member.displayName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="contact-section-card options-group">
            {onSearchInChat && (
              <div className="contact-option-row clickable" onClick={() => { onClose(); onSearchInChat(); }}>
                <div className="row-left">
                  <Search size={18} className="row-icon" />
                  <div className="row-text">
                    <span className="row-title">Search in Chat</span>
                  </div>
                </div>
              </div>
            )}

            <div className="contact-option-row clickable" onClick={() => muteConversation(conversation.id)}>
              <div className="row-left">
                <VolumeX size={18} className="row-icon" />
                <div className="row-text">
                  <span className="row-title">
                    {conversation.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="contact-option-row clickable"
              onClick={() => {
                if (window.confirm('Clear all messages in this group chat?')) {
                  clearConversation(conversation.id);
                  onClose();
                }
              }}
            >
              <div className="row-left">
                <Trash2 size={18} className="row-icon" style={{ color: 'var(--color-error, #ef4444)' }} />
                <div className="row-text">
                  <span className="row-title" style={{ color: 'var(--color-error, #ef4444)' }}>
                    Clear Chat History
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GroupDetailsModal;
