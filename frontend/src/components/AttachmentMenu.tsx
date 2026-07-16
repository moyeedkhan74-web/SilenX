import React, { useState, useRef, useEffect } from 'react';
import { Image, Camera, MapPin, User, FileText, BarChart3, CalendarDays, Video, X } from 'lucide-react';
import './AttachmentMenu.css';

interface AttachmentMenuProps {
  open: boolean;
  onClose: () => void;
  onSendImage: (imageDataUrl: string) => void;
  onSendCamera: (imageDataUrl: string) => void;
  onSendLocation: (data: { latitude: number; longitude: number; description: string }) => void;
  onSendContact: (data: { name: string; uid: string }) => void;
  onSendDocument: (data: { fileName: string; fileSize: string; dataUrl: string; fileType?: string }) => void;
  onSendPoll: (data: { question: string; options: string[] }) => void;
  onSendEvent: (data: { title: string; date: string; time: string; description?: string; location?: string }) => void;
}

type SubModal = 'none' | 'location' | 'contact' | 'poll' | 'event';

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  open,
  onClose,
  onSendImage,
  onSendCamera,
  onSendLocation,
  onSendContact,
  onSendDocument,
  onSendPoll,
  onSendEvent,
}) => {
  const [subModal, setSubModal] = useState<SubModal>('none');
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Location state
  const [locDesc, setLocDesc] = useState('');
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');

  // Contact state
  const [contactName, setContactName] = useState('');
  const [contactUid, setContactUid] = useState('');

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Event state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLoc, setEventLoc] = useState('');

  useEffect(() => {
    if (!open) {
      setSubModal('none');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  const resetAll = () => {
    setLocDesc(''); setLocLat(''); setLocLng('');
    setContactName(''); setContactUid('');
    setPollQuestion(''); setPollOptions(['', '']);
    setEventTitle(''); setEventDate(''); setEventTime(''); setEventDesc(''); setEventLoc('');
  };

  const closeAndReset = () => {
    resetAll();
    onClose();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'camera' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (type === 'image') onSendImage(dataUrl);
      else if (type === 'camera') onSendCamera(dataUrl);
      else onSendDocument({ fileName: file.name, fileSize: formatFileSize(file.size), dataUrl, fileType: file.type });
      closeAndReset();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLat(String(pos.coords.latitude));
        setLocLng(String(pos.coords.longitude));
      },
      () => alert('Unable to retrieve your location.')
    );
  };

  const items = [
    { icon: <Image size={22} />, label: 'Gallery', color: '#7c4dff', onClick: () => fileInputRef.current?.click() },
    { icon: <Video size={22} />, label: 'Video', color: '#009688', onClick: () => videoInputRef.current?.click() },
    { icon: <Camera size={22} />, label: 'Camera', color: '#e91e63', onClick: () => cameraInputRef.current?.click() },
    { icon: <MapPin size={22} />, label: 'Location', color: '#00c853', onClick: () => setSubModal('location') },
    { icon: <User size={22} />, label: 'Contact', color: '#2979ff', onClick: () => setSubModal('contact') },
    { icon: <FileText size={22} />, label: 'Document', color: '#6d4c9e', onClick: () => docInputRef.current?.click() },
    { icon: <BarChart3 size={22} />, label: 'Poll', color: '#ff6d00', onClick: () => setSubModal('poll') },
    { icon: <CalendarDays size={22} />, label: 'Event', color: '#e53935', onClick: () => setSubModal('event') },
  ];

  const renderSubModal = () => {
    switch (subModal) {
      case 'location':
        return (
          <div className="attach-sub-modal">
            <div className="attach-sub-header">
              <h4>📍 Share Location</h4>
              <button className="attach-sub-close" onClick={() => setSubModal('none')} type="button"><X size={16} /></button>
            </div>
            <div className="attach-sub-body">
              <button className="attach-auto-btn" type="button" onClick={handleGetCurrentLocation}>
                <MapPin size={16} /> Use current location
              </button>
              <input placeholder="Latitude" value={locLat} onChange={(e) => setLocLat(e.target.value)} className="attach-input" />
              <input placeholder="Longitude" value={locLng} onChange={(e) => setLocLng(e.target.value)} className="attach-input" />
              <input placeholder="Description (e.g. Coffee shop)" value={locDesc} onChange={(e) => setLocDesc(e.target.value)} className="attach-input" />
              <button
                className="attach-send-btn"
                type="button"
                disabled={!locLat || !locLng}
                onClick={() => { onSendLocation({ latitude: parseFloat(locLat), longitude: parseFloat(locLng), description: locDesc || 'Shared location' }); closeAndReset(); }}
              >
                Send Location
              </button>
            </div>
          </div>
        );
      case 'contact':
        return (
          <div className="attach-sub-modal">
            <div className="attach-sub-header">
              <h4>👤 Share Contact</h4>
              <button className="attach-sub-close" onClick={() => setSubModal('none')} type="button"><X size={16} /></button>
            </div>
            <div className="attach-sub-body">
              <input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="attach-input" />
              <input placeholder="Secure ID (e.g. SEC_abc123)" value={contactUid} onChange={(e) => setContactUid(e.target.value)} className="attach-input" />
              <button
                className="attach-send-btn"
                type="button"
                disabled={!contactName || !contactUid}
                onClick={() => { onSendContact({ name: contactName, uid: contactUid }); closeAndReset(); }}
              >
                Send Contact
              </button>
            </div>
          </div>
        );
      case 'poll':
        return (
          <div className="attach-sub-modal">
            <div className="attach-sub-header">
              <h4>📊 Create Poll</h4>
              <button className="attach-sub-close" onClick={() => setSubModal('none')} type="button"><X size={16} /></button>
            </div>
            <div className="attach-sub-body">
              <input placeholder="Ask a question..." value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} className="attach-input" />
              {pollOptions.map((opt, i) => (
                <div key={i} className="attach-poll-opt-row">
                  <input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }}
                    className="attach-input"
                  />
                  {pollOptions.length > 2 && (
                    <button className="attach-poll-remove" type="button" onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button className="attach-add-option" type="button" onClick={() => setPollOptions([...pollOptions, ''])}>
                  + Add option
                </button>
              )}
              <button
                className="attach-send-btn"
                type="button"
                disabled={!pollQuestion || pollOptions.filter(o => o.trim()).length < 2}
                onClick={() => { onSendPoll({ question: pollQuestion, options: pollOptions.filter(o => o.trim()) }); closeAndReset(); }}
              >
                Send Poll
              </button>
            </div>
          </div>
        );
      case 'event':
        return (
          <div className="attach-sub-modal">
            <div className="attach-sub-header">
              <h4>📅 Create Event</h4>
              <button className="attach-sub-close" onClick={() => setSubModal('none')} type="button"><X size={16} /></button>
            </div>
            <div className="attach-sub-body">
              <input placeholder="Event title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="attach-input" />
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="attach-input" />
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="attach-input" />
              <input placeholder="Description (optional)" value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} className="attach-input" />
              <input placeholder="Location (optional)" value={eventLoc} onChange={(e) => setEventLoc(e.target.value)} className="attach-input" />
              <button
                className="attach-send-btn"
                type="button"
                disabled={!eventTitle || !eventDate || !eventTime}
                onClick={() => { onSendEvent({ title: eventTitle, date: eventDate, time: eventTime, description: eventDesc || undefined, location: eventLoc || undefined }); closeAndReset(); }}
              >
                Send Event
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="attach-menu-container" ref={menuRef}>
      {subModal !== 'none' ? renderSubModal() : (
        <div className="attach-menu-grid">
          {items.map((item) => (
            <button key={item.label} className="attach-menu-item" type="button" onClick={item.onClick}>
              <div className="attach-menu-icon" style={{ background: item.color }}>{item.icon}</div>
              <span className="attach-menu-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          handleFileSelected(e, file?.type.startsWith('video/') ? 'video' : 'image');
        }}
      />
      <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={(e) => handleFileSelected(e, 'video')} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFileSelected(e, 'camera')} />
      <input ref={docInputRef} type="file" accept="*/*" hidden onChange={(e) => handleFileSelected(e, 'document')} />
    </div>
  );
};

export default AttachmentMenu;
