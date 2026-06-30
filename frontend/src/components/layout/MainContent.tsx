import React from 'react';

interface MainContentProps {
  children: React.ReactNode;
}

export const MainContent: React.FC<MainContentProps> = ({ children }) => {
  return (
    <div className="main-content" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {children}
    </div>
  );
};

export default MainContent;
