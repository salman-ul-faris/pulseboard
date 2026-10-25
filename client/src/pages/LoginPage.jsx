import React, { useState } from 'react';
import Logo from '../components/Logo.jsx';
import BackgroundWave from '../components/BackgroundWave.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Eye, EyeOff, LogIn, ArrowRight } from 'lucide-react';

export default function LoginPage({ onNavigateRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAuthError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setAuthError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '24px',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      <BackgroundWave />

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(16, 26, 43, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-card), 0 0 35px rgba(56, 242, 165, 0.05)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Logo size="large" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '18px', color: 'var(--text-primary)' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Sign in to access your synchronized workspaces
          </p>
        </div>

        {/* Global Auth Error */}
        {authError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 92, 92, 0.12)',
              border: '1px solid rgba(255, 92, 92, 0.3)',
              color: 'var(--accent-coral)',
              fontSize: '0.8125rem',
              marginBottom: '20px',
            }}
          >
            {authError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="alex@pulseboard.io"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: null });
              }}
              autoComplete="email"
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: null });
                }}
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          {/* Submit */}
          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? (
              'Authenticating...'
            ) : (
              <>
                <LogIn size={16} />
                <span>Sign In to PulseBoard</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div
          style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          Don't have an account?{' '}
          <button
            id="link-go-to-register"
            onClick={onNavigateRegister}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'inherit',
            }}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}
