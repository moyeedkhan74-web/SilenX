import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CallOverlay from './components/CallOverlay';
import './App.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // For development, force true if you just want to see the dashboard UI
  // return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
  return <>{children}</>;
};

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
        
        {/* Global Overlays */}
        <CallOverlay />
      </div>
    </BrowserRouter>
  );
}

export default App;
