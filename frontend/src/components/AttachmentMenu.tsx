import React, { useState, useRef, useEffect } from 'react';
import { Image, Camera, MapPin, User, FileText, BarChart3, CalendarDays, Video, X, Lock } from 'lucide-react';
import { capturePhoto } from '../services/camera';
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
  onSelectFiles?: (files: File[]) => void;
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
  onSelectFiles,
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (onSelectFiles && type !== 'camera') {
      onSelectFiles(files);
      closeAndReset();
      e.target.value = '';
      return;
    }

    const sendFile = (file: File, fileType: 'image' | 'camera' | 'video' | 'document') => {
      const isVideo = file.type.startsWith('video/');

      if (fileType === 'camera') {
        const reader = new FileReader();
        reader.onload = () => onSendCamera(reader.result as string);
        reader.readAsDataURL(file);
      } else if (isVideo || fileType === 'video') {
        if (file.size > 100 * 1024 * 1024) {
          window.alert(`"${file.name}" is too large (max 100 MB). Skipped.`);
          return;
        }
        const blobUrl = URL.createObjectURL(file);
        onSendDocument({ fileName: file.name, fileSize: formatFileSize(file.size), dataUrl: blobUrl, fileType: file.type });
      } else if (fileType === 'image') {
        if (file.size > 8 * 1024 * 1024) {
          window.alert(`"${file.name}" is too large (max 8 MB). Skipped.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => onSendImage(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        if (file.size > 20 * 1024 * 1024) {
          window.alert(`"${file.name}" is too large (max 20 MB). Skipped.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => onSendDocument({
          fileName: file.name, fileSize: formatFileSize(file.size),
          dataUrl: reader.result as string, fileType: file.type,
        });
        reader.readAsDataURL(file);
      }
    };

    // Send all files with a small stagger so messages arrive in order
    files.forEach((file, idx) => {
      const resolvedType = type === 'image' && file.type.startsWith('video/') ? 'video' : type;
      setTimeout(() => sendFile(file, resolvedType), idx * 50);
    });

    closeAndReset();
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
     {
       icon: <Camera size={56} />,
       label: 'Camera',
       desc: 'Instant capture',
       color: 'var(--color-accent)',
       onClick: async () => {
         const photo = await capturePhoto();
         if (photo?.dataUrl) {
           onSendCamera(photo.dataUrl);
           closeAndReset();
         }
       }
     },
    {
      icon: <Image size={24} />,
      label: 'Gallery',
      desc: 'Photos & video',
      color: 'var(--color-text-primary)',
      onClick: () => fileInputRef.current?.click()
    },
    {
      icon: <FileText size={24} />,
      label: 'Document',
      desc: 'Files & PDF',
      color: 'var(--color-accent)',
      onClick: () => docInputRef.current?.click()
    },
    {
      icon: <MapPin size={24} />,
      label: 'Location',
      desc: 'Live or pinned',
      color: 'var(--color-text-primary)',
      onClick: () => setSubModal('location')
    },
    {
      icon: <User size={24} />,
      label: 'Contact',
      desc: 'vCard export',
      color: 'var(--color-accent)',
      onClick: () => setSubModal('contact')
    },
    {
      icon: <BarChart3 size={24} />,
      label: 'Poll',
      desc: 'Anonymous',
      color: 'var(--color-text-primary)',
      onClick: () => setSubModal('poll')
    },
    {
      icon: <Video size={24} />,
      label: 'Video',
      desc: 'Clips & media',
      color: 'var(--color-accent)',
      onClick: () => videoInputRef.current?.click()
    },
    {
      icon: <CalendarDays size={24} />,
      label: 'Event',
      desc: 'Calendar date',
      color: 'var(--color-text-primary)',
      onClick: () => setSubModal('event')
    },
  ];

  const renderSubModal = () => {
    switch (subModal) {
      case 'location':
        return (
          <div className="attach-sub-modal">
            <div className="attach-sub-header">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={16} /> Share Location</h4>
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
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={16} /> Share Contact</h4>
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
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={16} /> Create Poll</h4>
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
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={16} /> Create Event</h4>
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
    <>
      <div className="attach-backdrop" onClick={closeAndReset} />
      <div className="attach-menu-container" ref={menuRef}>
        <div className="attach-sheet-handle" />
        <div className="attach-sheet-header">
          <div className="attach-sheet-header-title">
            <Lock size={18} className="attach-sheet-lock" />
            <span>Share Encrypted Content</span>
          </div>
          <button className="attach-sheet-close" onClick={closeAndReset} type="button" aria-label="Close sheet">
            <X size={20} />
          </button>
        </div>

        {subModal !== 'none' ? renderSubModal() : (
          <div className="attach-menu-grid">
            {items.map((item) => (
              <button key={item.label} className="attach-menu-item" type="button" onClick={item.onClick}>
                <div className="attach-menu-icon" style={{ background: item.color }}>
                  {item.icon}
                </div>
                <span className="attach-menu-label">{item.label}</span>
                {item.desc && <span className="attach-menu-desc">{item.desc}</span>}
              </button>
            ))}
          </div>
        )}

        <button className="attach-sheet-cancel-btn" type="button" onClick={closeAndReset}>
          Cancel
        </button>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => handleFileSelected(e, 'image')}
        />
        <input ref={videoInputRef} type="file" accept="video/*" multiple hidden onChange={(e) => handleFileSelected(e, 'video')} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFileSelected(e, 'camera')} />
        <input ref={docInputRef} type="file" accept="*/*" multiple hidden onChange={(e) => handleFileSelected(e, 'document')} />
      </div>
    </>
  );
};

export default AttachmentMenu;
