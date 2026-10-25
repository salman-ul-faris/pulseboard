import React from 'react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  ListTodo, 
  Settings, 
  LogOut, 
  X,
  User
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, currentFilter, setCurrentFilter, isOpen, onClose }) {
  const { user, logout } = useAuth();

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      active: currentView === 'dashboard' && currentFilter === 'all',
      onClick: () => {
        setCurrentView('dashboard');
        setCurrentFilter('all');
        if (onClose) onClose();
      },
    },
    {
      id: 'active',
      label: 'My Tasks',
      icon: ListTodo,
      active: currentView === 'dashboard' && currentFilter === 'active',
      onClick: () => {
        setCurrentView('dashboard');
        setCurrentFilter('active');
        if (onClose) onClose();
      },
    },
    {
      id: 'completed',
      label: 'Completed',
      icon: CheckCircle2,
      active: currentView === 'dashboard' && currentFilter === 'completed',
      onClick: () => {
        setCurrentView('dashboard');
        setCurrentFilter('completed');
        if (onClose) onClose();
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      active: currentView === 'settings',
      onClick: () => {
        setCurrentView('settings');
        if (onClose) onClose();
      },
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 9, 18, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      <aside
        className={`pulseboard-sidebar ${isOpen ? 'open' : ''}`}
        style={{
          width: '260px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          transition: 'transform var(--transition-normal)',
        }}
      >
        {/* Header / Brand */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Logo size="medium" />
          {isOpen && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px', minWidth: 'auto', display: 'md-none' }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav style={{ padding: '20px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 6px' }}>
            Workspaces
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 14px',
                  background: item.active ? 'rgba(56, 242, 165, 0.1)' : 'transparent',
                  color: item.active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: item.active ? '1px solid rgba(56, 242, 165, 0.25)' : '1px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  fontWeight: item.active ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon size={18} color={item.active ? 'var(--accent-primary)' : 'currentColor'} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.active && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      boxShadow: '0 0 8px var(--accent-primary)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Logout Section */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(7, 11, 18, 0.5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 26, 43, 0.6)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '10px',
            }}
          >
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user?.name || 'User profile'}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1.5px solid var(--accent-primary)',
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement.querySelector('.avatar-initials-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            )}
            <div
              className="avatar-initials-fallback"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #38F2A5 0%, #54C8E8 100%)',
                color: '#070B12',
                display: user?.avatarUrl ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.875rem',
                flexShrink: 0,
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'Pulse User'}
              </div>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.email || 'user@pulseboard.io'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="btn btn-secondary btn-sm"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--accent-coral)',
              borderColor: 'rgba(255, 92, 92, 0.2)',
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <style>{`
        @media (max-width: 900px) {
          .pulseboard-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
            z-index: 1000 !important;
          }
          .pulseboard-sidebar.open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
