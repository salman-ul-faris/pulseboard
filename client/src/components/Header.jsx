import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Plus, Menu, Calendar } from 'lucide-react';

export default function Header({ onOpenCreateTask, onToggleSidebar }) {
  const { user } = useAuth();

  // Contextual greeting based on local time
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17) {
    greeting = 'Good evening';
  }

  // Format date: e.g. "Sunday, October 25, 2026"
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <header
      style={{
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(11, 18, 32, 0.4)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onToggleSidebar}
          className="btn btn-secondary btn-sm mobile-menu-btn"
          style={{ padding: '8px', display: 'none' }}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            {greeting}, <span style={{ color: 'var(--accent-primary)' }}>{firstName}</span>
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            <Calendar size={13} color="var(--accent-cyan)" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          id="btn-create-task-header"
          onClick={onOpenCreateTask}
          className="btn btn-primary"
          style={{ padding: '10px 18px', fontSize: '0.875rem' }}
        >
          <Plus size={18} />
          <span>Create Task</span>
        </button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mobile-menu-btn {
            display: inline-flex !important;
          }
          header {
            padding: 16px 20px !important;
          }
        }
      `}</style>
    </header>
  );
}
