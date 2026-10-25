import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import Logo from './components/Logo.jsx';

function MainApplication() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'settings'
  const [currentFilter, setCurrentFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initial loading splash
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-main)',
          gap: '16px',
        }}
      >
        <Logo size="large" />
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          INITIALIZING SECURE SESSION...
        </div>
      </div>
    );
  }

  // Unauthenticated view: Login or Register
  if (!user) {
    if (authMode === 'register') {
      return <RegisterPage onNavigateLogin={() => setAuthMode('login')} />;
    }
    return <LoginPage onNavigateRegister={() => setAuthMode('register')} />;
  }

  // Authenticated workspace shell
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      {currentView === 'dashboard' ? (
        <DashboardPage
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      ) : (
        <SettingsPage onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
}
