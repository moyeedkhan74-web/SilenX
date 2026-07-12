import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import MainContent from '../components/layout/MainContent';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-page" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <MainContent>
        <Outlet />
      </MainContent>
    </div>
  );
};

export default DashboardPage;
