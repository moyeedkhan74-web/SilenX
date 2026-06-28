import React from 'react';
import { UserPlus } from 'lucide-react';
import './ContactsTab.css';

interface ContactsTabProps {
  onAddClick: () => void;
}

const ContactsTab: React.FC<ContactsTabProps> = ({ onAddClick }) => {
  return (
    <div className="contacts-tab">
      <div className="contacts-header">
        <h2>Contacts</h2>
        <button className="add-contact-btn" onClick={onAddClick}>+ Add Contact</button>
      </div>

      <div className="contacts-empty">
        <div className="empty-icon-wrap">
          <UserPlus size={32} strokeWidth={1.5} />
        </div>
        <p className="contacts-empty-title">No contacts yet</p>
        <p className="contacts-empty-subtext">Add secure contacts by scanning their QR code or entering their 16-character secure ID.</p>
        <button className="btn btn-primary" onClick={onAddClick}>Add New Contact</button>
      </div>
    </div>
  );
};

export default ContactsTab;
