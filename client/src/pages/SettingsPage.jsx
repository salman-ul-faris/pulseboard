import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { 
  User, 
  Palette, 
  Bell, 
  Shield, 
  Check, 
  AlertCircle, 
  Save, 
  LogOut, 
  Camera, 
  Trash2, 
  Upload, 
  X,
  RefreshCw 
} from 'lucide-react';

export default function SettingsPage({ onToggleSidebar }) {
  const { user, logout, updateUserLocally } = useAuth();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Profile Picture state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  // Appearance & Preferences
  const [theme, setTheme] = useState('dark');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [taskRemindersEnabled, setTaskRemindersEnabled] = useState(true);
  const [completionNotificationsEnabled, setCompletionNotificationsEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
    return () => {
      // Clean up object URL if component unmounts
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.settings.get();
      const s = res.settings;
      setName(s.name || user?.name || '');
      setEmail(s.email || user?.email || '');
      setTheme(s.theme || 'dark');
      setReducedMotion(Boolean(s.reducedMotion));
      setTaskRemindersEnabled(Boolean(s.taskRemindersEnabled));
      setCompletionNotificationsEnabled(Boolean(s.completionNotificationsEnabled));

      if (s.avatarUrl && s.avatarUrl !== user?.avatarUrl) {
        updateUserLocally({ avatarUrl: s.avatarUrl });
      }

      // Synchronize DOM class for reduced motion immediately
      if (s.reducedMotion) {
        document.body.classList.add('reduced-motion');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    } catch (err) {
      setError('Failed to load user settings');
    } finally {
      setLoading(false);
    }
  }

  // Handle local file selection and create client-side preview
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    setAvatarError(null);
    setMessage(null);

    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setAvatarError('Unsupported file type. Please select a JPEG, PNG, or WebP raster image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (5 MB limit)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError(`Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Revoke previous preview URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  }

  function handleCancelPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setAvatarError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Upload or replace profile picture (uses direct signed Cloudinary upload on serverless, with multipart fallback)
  async function handleSaveAvatar() {
    if (!selectedFile) return;

    setAvatarUploading(true);
    setAvatarError(null);
    setMessage(null);

    try {
      // 1. Check if backend provides a signed Cloudinary direct upload ticket
      let signData = null;
      try {
        signData = await api.settings.getProfilePictureSignature();
      } catch (_) {
        signData = null;
      }

      if (signData && signData.directUploadSupported) {
        // Direct Cloudinary CDN upload - completely bypasses Netlify Functions payload limits
        const cloudFormData = new FormData();
        cloudFormData.append('file', selectedFile);
        cloudFormData.append('api_key', signData.apiKey);
        cloudFormData.append('timestamp', signData.timestamp);
        cloudFormData.append('signature', signData.signature);
        cloudFormData.append('public_id', signData.publicId);
        cloudFormData.append('folder', signData.folder);
        cloudFormData.append('transformation', signData.transformation);
        cloudFormData.append('tags', signData.tags);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
          {
            method: 'POST',
            body: cloudFormData,
          }
        );

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json().catch(() => ({}));
          throw new Error(uploadErr.error?.message || 'Failed to upload image directly to cloud storage.');
        }

        const uploadResult = await uploadRes.json();

        // Commit verified upload to PulseBoard PostgreSQL backend
        const commitRes = await api.settings.commitProfilePicture({
          publicId: uploadResult.public_id,
          avatarUrl: uploadResult.secure_url,
        });

        updateUserLocally({ avatarUrl: commitRes.avatarUrl });
        setMessage('Profile picture updated and saved successfully.');
        handleCancelPreview();
      } else {
        // Standard multipart upload fallback (for dev or local testing)
        const formData = new FormData();
        formData.append('avatar', selectedFile);

        const res = await api.settings.uploadProfilePicture(formData);
        updateUserLocally({ avatarUrl: res.avatarUrl });
        setMessage('Profile picture updated and saved successfully.');
        handleCancelPreview();
      }
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload profile picture.');
    } finally {
      setAvatarUploading(false);
    }
  }


  // Remove profile picture and restore initials
  async function handleRemoveAvatar() {
    if (!window.confirm('Are you sure you want to remove your profile picture and restore the default avatar?')) {
      return;
    }

    setAvatarRemoving(true);
    setAvatarError(null);
    setMessage(null);

    try {
      await api.settings.deleteProfilePicture();
      updateUserLocally({ avatarUrl: null });
      setMessage('Profile picture removed successfully.');
      handleCancelPreview();
    } catch (err) {
      setAvatarError(err.message || 'Failed to remove profile picture.');
    } finally {
      setAvatarRemoving(false);
    }
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const updates = {
        name,
        theme,
        reducedMotion,
        taskRemindersEnabled,
        completionNotificationsEnabled,
      };

      await api.settings.update(updates);
      setMessage('Settings updated and saved successfully.');

      // Update auth context display name
      if (name !== user?.name) {
        updateUserLocally({ name });
      }

      // Apply reduced motion class dynamically
      if (reducedMotion) {
        document.body.classList.add('reduced-motion');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const currentDisplayAvatar = previewUrl || user?.avatarUrl;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
      {/* Top Header */}
      <div
        style={{
          padding: '24px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(11, 18, 32, 0.4)',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>System Settings</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Manage your account profile, visual ergonomics, and app preferences
        </p>
      </div>

      <main style={{ padding: '28px 32px', maxWidth: '860px', width: '100%', margin: '0 auto', flex: 1 }}>
        {/* Notification alerts */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(56, 242, 165, 0.12)',
              border: '1px solid rgba(56, 242, 165, 0.3)',
              color: 'var(--accent-primary)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <Check size={16} />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 92, 92, 0.12)',
              border: '1px solid rgba(255, 92, 92, 0.3)',
              color: 'var(--accent-coral)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '28px',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'preferences', label: 'Preferences', icon: Bell },
            { id: 'account', label: 'Account', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMessage(null);
                  setError(null);
                  setAvatarError(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Profile */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Profile Picture Card */}
            <div className="card">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '6px' }}>Profile Picture</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Upload a custom picture to personalize your workspace presence. Accepted formats: JPEG, PNG, WebP (max 5 MB).
              </p>

              {avatarError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 92, 92, 0.12)',
                    border: '1px solid rgba(255, 92, 92, 0.3)',
                    color: 'var(--accent-coral)',
                    fontSize: '0.8125rem',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{avatarError}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Avatar Display Frame */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '20px',
                      border: previewUrl
                        ? '2px dashed var(--accent-primary)'
                        : '2px solid var(--border-accent)',
                      background: 'rgba(11, 18, 32, 0.8)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(56, 242, 165, 0.12)',
                    }}
                  >
                    {currentDisplayAvatar ? (
                      <img
                        src={currentDisplayAvatar}
                        alt="Profile avatar preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement.querySelector('.avatar-large-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}

                    <div
                      className="avatar-large-fallback"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: currentDisplayAvatar ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #38F2A5 0%, #54C8E8 100%)',
                        color: '#070B12',
                      }}
                    >
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  </div>

                  {previewUrl && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: 'var(--accent-primary)',
                        color: '#070B12',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-full)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Preview
                    </span>
                  )}
                </div>

                {/* Upload & Action Controls */}
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    id="profile-picture-input"
                  />

                  {previewUrl ? (
                    /* Preview Actions: Save or Cancel */
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '10px', fontWeight: 500 }}>
                        Image selected: <span style={{ color: 'var(--accent-primary)' }}>{selectedFile?.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          id="btn-save-avatar"
                          type="button"
                          onClick={handleSaveAvatar}
                          className="btn btn-primary btn-sm"
                          disabled={avatarUploading}
                        >
                          {avatarUploading ? (
                            <>
                              <RefreshCw size={14} className="spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              <span>Save Picture</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelPreview}
                          className="btn btn-secondary btn-sm"
                          disabled={avatarUploading}
                        >
                          <X size={14} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Default Actions: Upload / Change & Remove */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        id="btn-upload-avatar"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-outline btn-sm"
                      >
                        <Camera size={14} />
                        <span>{user?.avatarUrl ? 'Change Picture' : 'Upload Picture'}</span>
                      </button>

                      {user?.avatarUrl && (
                        <button
                          id="btn-remove-avatar"
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="btn btn-danger btn-sm"
                          disabled={avatarRemoving}
                        >
                          <Trash2 size={14} />
                          <span>{avatarRemoving ? 'Removing...' : 'Remove Picture'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                    Uploaded images are automatically sanitized, centered, and optimized for fast display.
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Form Details */}
            <div className="card">
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '6px' }}>Public Information</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Your display name is visible across shared task workspaces and activity feeds.
              </p>

              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-name">
                    Display Name
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="settings-email">
                    Email Address
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    className="form-input"
                    value={email}
                    disabled
                    style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Email address is tied to your login identity and cannot be modified.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                  <button id="btn-save-profile" type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setName(user?.name || '');
                      setMessage(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: Appearance */}
        {activeTab === 'appearance' && (
          <div className="card">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '6px' }}>Visual Appearance</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Customize theme and motion behavior. Changes persist to your cloud profile.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <div className="form-label" style={{ marginBottom: '8px' }}>Interface Theme</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-main)',
                    border: '2px solid var(--accent-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Deep Navy (Default)</span>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    High contrast dark palette with electric mint accents.
                  </div>
                </div>
              </div>
            </div>

            {/* Reduced Motion Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Reduced Motion
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Minimize wave animations and transition effects across the interface.
                </div>
              </div>

              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                <input
                  id="toggle-reduced-motion"
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    setReducedMotion(newVal);
                    if (newVal) {
                      document.body.classList.add('reduced-motion');
                    } else {
                      document.body.classList.remove('reduced-motion');
                    }
                  }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: reducedMotion ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)',
                    transition: '0.2s',
                    borderRadius: '24px',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '',
                      height: '18px',
                      width: '18px',
                      left: reducedMotion ? '22px' : '3px',
                      bottom: '3px',
                      backgroundColor: reducedMotion ? '#070B12' : '#ffffff',
                      transition: '0.2s',
                      borderRadius: '50%',
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button id="btn-save-appearance" onClick={handleSaveSettings} className="btn btn-primary" disabled={saving}>
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Appearance Preferences'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Preferences */}
        {activeTab === 'preferences' && (
          <div className="card">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '6px' }}>Task Preferences</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Configure task activity signals and workflow reminders.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Task Reminders */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Task Due Date Reminders</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Highlight tasks approaching their deadline on your dashboard view.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={taskRemindersEnabled}
                  onChange={(e) => setTaskRemindersEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Completion Notification */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Completion Signals</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Show visual celebration glow and metrics bump upon task completion.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={completionNotificationsEnabled}
                  onChange={(e) => setCompletionNotificationsEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button onClick={handleSaveSettings} className="btn btn-primary" disabled={saving}>
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Account */}
        {activeTab === 'account' && (
          <div className="card">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '6px' }}>Account & Session</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Manage your current session and authentication credentials.
            </p>

            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 92, 92, 0.08)',
                border: '1px solid rgba(255, 92, 92, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--accent-coral)' }}>
                  Sign Out from PulseBoard
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Terminate your active authenticated session on this browser.
                </div>
              </div>
              <button onClick={logout} className="btn btn-danger btn-sm">
                <LogOut size={15} />
                <span>Confirm Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
