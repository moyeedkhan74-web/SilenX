import React from 'react';

interface ReplyPreviewProps {
  sender: string;
  text: string;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ sender, text }) => {
  return (
    <div className="reply-preview-card" role="status">
      <div className="reply-preview-title">Replying to {sender}</div>
      <div className="reply-preview-text">{text}</div>
    </div>
  );
};

export default ReplyPreview;
