import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setLoading(true);
    try {
      const res = await api.auth.me();
      if (res && res.user) {
        setUser(res.user);
        // Also fetch and apply user settings (such as reduced motion)
        try {
          const sRes = await api.settings.get();
          if (sRes && sRes.settings && sRes.settings.reducedMotion) {
            document.body.classList.add('reduced-motion');
          }
        } catch (_) {}
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(credentials) {
    setError(null);
    try {
      const res = await api.auth.login(credentials);
      setUser(res.user);
      // Fetch settings
      try {
        const sRes = await api.settings.get();
        if (sRes && sRes.settings && sRes.settings.reducedMotion) {
          document.body.classList.add('reduced-motion');
        } else {
          document.body.classList.remove('reduced-motion');
        }
      } catch (_) {}
      return res.user;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }

  async function register(userData) {
    setError(null);
    try {
      const res = await api.auth.register(userData);
      setUser(res.user);
      return res.user;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  }

  async function logout() {
    try {
      await api.auth.logout();
    } catch (_) {
      // Continue client cleanup regardless
    } finally {
      setUser(null);
      document.body.classList.remove('reduced-motion');
    }
  }

  function updateUserLocally(updates) {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkSession,
    updateUserLocally,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
