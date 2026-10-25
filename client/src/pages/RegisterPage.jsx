import React, { useState } from 'react';
import Logo from '../components/Logo.jsx';
import BackgroundWave from '../components/BackgroundWave.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Eye, EyeOff, UserPlus, CheckSquare, Square } from 'lucide-react';

export default function RegisterPage({ onNavigateLogin }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!name.trim()) {
      errs.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      errs.terms = 'You must accept the terms of service';
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
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      setAuthError(err.message || 'Registration failed');
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
          maxWidth: '460px',
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
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Logo size="large" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '16px', color: 'var(--text-primary)' }}>
            Create your account
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Get started with real-time productivity intelligence
          </p>
        </div>

        {/* Global Error Banner */}
        {authError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 92, 92, 0.12)',
              border: '1px solid rgba(255, 92, 92, 0.3)',
              color: 'var(--accent-coral)',
              fontSize: '0.8125rem',
              marginBottom: '18px',
            }}
          >
            {authError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Alex Vance"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: null });
              }}
              autoComplete="name"
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="register-email">
              Email Address
            </label>
            <input
              id="register-email"
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

          {/* Password & Confirm Password in Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="register-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Min 8 chars"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '8px',
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
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-confirm">
                Confirm
              </label>
              <input
                id="register-confirm"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                }}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
            </div>
          </div>

          {/* Terms checkbox */}
          <div style={{ marginTop: '8px', marginBottom: '18px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (errors.terms) setErrors({ ...errors, terms: null });
                }}
                style={{
                  marginTop: '3px',
                  accentColor: 'var(--accent-primary)',
                  cursor: 'pointer',
                }}
              />
              <span>
                I agree to the <span style={{ color: 'var(--accent-primary)' }}>Terms of Service</span> and{' '}
                <span style={{ color: 'var(--accent-primary)' }}>Privacy Policy</span>
              </span>
            </label>
            {errors.terms && <div className="form-error" style={{ marginLeft: '24px' }}>{errors.terms}</div>}
          </div>

          {/* Submit */}
          <button
            id="btn-register-submit"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={loading}
          >
            {loading ? (
              'Creating Account...'
            ) : (
              <>
                <UserPlus size={16} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div
          style={{
            marginTop: '22px',
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          Already have an account?{' '}
          <button
            id="link-go-to-login"
            onClick={onNavigateLogin}
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
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
