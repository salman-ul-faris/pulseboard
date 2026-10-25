import React, { useState, useEffect } from 'react';
import { X, Calendar, Flag, AlignLeft, Check } from 'lucide-react';

export default function TaskModal({ isOpen, onClose, onSave, task = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
    }
    setError('');
  }, [task, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 92, 92, 0.1)',
                border: '1px solid rgba(255, 92, 92, 0.25)',
                color: 'var(--accent-coral)',
                fontSize: '0.8125rem',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">
              Task Title <span style={{ color: 'var(--accent-coral)' }}>*</span>
            </label>
            <input
              id="task-title"
              type="text"
              className={`form-input ${error && !title.trim() ? 'error' : ''}`}
              placeholder="e.g., Finalize product roadmap"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="task-description">
              Description (Optional)
            </label>
            <textarea
              id="task-description"
              className="form-textarea"
              rows={3}
              placeholder="Add key context, links, or sub-deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority & Due Date Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="task-due-date">
                Due Date
              </label>
              <input
                id="task-due-date"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button id="btn-save-task" type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
