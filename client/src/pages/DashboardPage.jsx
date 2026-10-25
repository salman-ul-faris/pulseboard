import React, { useState, useEffect } from 'react';
import Header from '../components/Header.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import api from '../services/api.js';
import { Search, Plus, Filter, AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardPage({ currentFilter, setCurrentFilter, onToggleSidebar }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, [currentFilter, priorityFilter]);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (currentFilter && currentFilter !== 'all') {
        params.filter = currentFilter;
      }
      if (priorityFilter) {
        params.priority = priorityFilter;
      }
      const res = await api.tasks.getAll(params);
      setTasks(res.tasks || []);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  // Filter tasks client-side for live search responsiveness
  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query))
    );
  });

  async function handleCreateOrUpdateTask(taskData) {
    if (editingTask) {
      // Update
      const res = await api.tasks.update(editingTask.id, taskData);
      setTasks(tasks.map((t) => (t.id === editingTask.id ? res.task : t)));
    } else {
      // Create
      const res = await api.tasks.create(taskData);
      setTasks([res.task, ...tasks]);
    }
  }

  async function handleToggleComplete(taskId, completed) {
    // Optimistic update
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)));
    try {
      const res = await api.tasks.update(taskId, { completed });
      setTasks(tasks.map((t) => (t.id === taskId ? res.task : t)));
    } catch (err) {
      // Revert if error
      fetchTasks();
    }
  }

  async function handleDeleteTask(taskId) {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    // Optimistic update
    setTasks(tasks.filter((t) => t.id !== taskId));
    try {
      await api.tasks.delete(taskId);
    } catch (err) {
      fetchTasks();
    }
  }

  function handleOpenCreate() {
    setEditingTask(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(task) {
    setEditingTask(task);
    setIsModalOpen(true);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
      <Header onOpenCreateTask={handleOpenCreate} onToggleSidebar={onToggleSidebar} />

      <main style={{ padding: '28px 32px', flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* Metric Summary Cards calculated from actual tasks */}
        <SummaryCards tasks={tasks} />

        {/* Filter & Search Bar Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          {/* Status Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-secondary)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentFilter(tab.id)}
                style={{
                  background: currentFilter === tab.id ? 'var(--bg-card)' : 'transparent',
                  color: currentFilter === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: currentFilter === tab.id ? '1px solid rgba(56, 242, 165, 0.2)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  fontWeight: currentFilter === tab.id ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Priority Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                id="search-tasks-input"
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px', fontSize: '0.8125rem', padding: '8px 12px 8px 34px' }}
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            {/* Priority Selector */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.8125rem', padding: '8px 12px' }}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            {/* Refresh */}
            <button
              onClick={fetchTasks}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px' }}
              title="Refresh task list"
              aria-label="Refresh task list"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Task List or States */}
        {error ? (
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(255, 92, 92, 0.1)',
              border: '1px solid rgba(255, 92, 92, 0.25)',
              color: 'var(--accent-coral)',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={24} style={{ marginBottom: '8px' }} />
            <div>{error}</div>
            <button onClick={fetchTasks} className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}>
              Try Again
            </button>
          </div>
        ) : loading && tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: '12px', fontSize: '0.875rem' }}>Loading synchronized tasks...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          /* Empty State */
          <div
            style={{
              padding: '54px 20px',
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              border: '1px dashed var(--border-light)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(56, 242, 165, 0.1)',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Plus size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '6px' }}>
              {searchQuery ? 'No matching tasks found' : 'No tasks in this view'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 20px' }}>
              {searchQuery
                ? `No tasks match the keyword "${searchQuery}". Try clearing your search.`
                : 'Create your first task to start organizing your workflow with PulseBoard.'}
            </p>
            {searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="btn btn-secondary btn-sm">
                Clear Search
              </button>
            ) : (
              <button onClick={handleOpenCreate} className="btn btn-primary btn-sm">
                <Plus size={16} />
                <span>Create a Task</span>
              </button>
            )}
          </div>
        ) : (
          /* Active Tasks Grid/List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateOrUpdateTask}
        task={editingTask}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @media (max-width: 900px) {
          main {
            padding: 16px 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
