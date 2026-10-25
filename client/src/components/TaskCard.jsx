import React from 'react';
import { Check, Edit2, Trash2, Calendar, AlertCircle } from 'lucide-react';

export default function TaskCard({ task, onToggleComplete, onEdit, onDelete }) {
  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  const formattedDueDate = task.dueDate
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(task.dueDate))
    : null;

  return (
    <div
      className="card task-item"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '16px 20px',
        background: task.completed ? 'rgba(16, 26, 43, 0.4)' : 'var(--bg-card)',
        borderColor: task.completed ? 'rgba(255, 255, 255, 0.04)' : 'var(--border-subtle)',
        opacity: task.completed ? 0.75 : 1,
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleComplete(task.id, !task.completed)}
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '6px',
          border: task.completed ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.25)',
          background: task.completed ? 'var(--accent-primary)' : 'rgba(11, 18, 32, 0.6)',
          color: '#070B12',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          marginTop: '2px',
          transition: 'all var(--transition-fast)',
        }}
        aria-label={task.completed ? 'Mark task active' : 'Mark task completed'}
      >
        {task.completed && <Check size={14} strokeWidth={3} />}
      </button>

      {/* Task Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <h3
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: task.completed ? 'line-through' : 'none',
              wordBreak: 'break-word',
            }}
          >
            {task.title}
          </h3>

          {/* Priority Badge */}
          <span className={`badge-priority ${task.priority}`}>
            {task.priority}
          </span>
        </div>

        {task.description && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              margin: '4px 0 8px',
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {task.description}
          </p>
        )}

        {/* Due Date Indicator */}
        {formattedDueDate && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              color: isOverdue ? 'var(--accent-coral)' : 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {isOverdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
            <span>Due {formattedDueDate}</span>
            {isOverdue && <span style={{ fontWeight: 600 }}>(Overdue)</span>}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onEdit(task)}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px', color: 'var(--text-secondary)' }}
          title="Edit task"
          aria-label="Edit task"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px', color: 'var(--accent-coral)' }}
          title="Delete task"
          aria-label="Delete task"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
