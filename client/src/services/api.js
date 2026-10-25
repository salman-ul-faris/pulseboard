// PulseBoard API Service layer

// Support configurable VITE_API_URL for Vercel deployment pointing to Render backend
const rawApiUrl = import.meta.env.VITE_API_URL || '';
const BASE_URL = rawApiUrl ? `${rawApiUrl.replace(/\/+$/, '')}/api` : '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include', // Ensures session cookies work across domains (Vercel -> Render)
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    const error = new Error('Network connection error: Unable to reach PulseBoard backend API.');
    error.status = 0;
    error.originalError = netErr;
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || data.error || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  auth: {
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me', { method: 'GET' }),
  },
  tasks: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.filter) query.set('filter', params.filter);
      if (params.search) query.set('search', params.search);
      if (params.priority) query.set('priority', params.priority);
      const qs = query.toString();
      return request(`/tasks${qs ? `?${qs}` : ''}`, { method: 'GET' });
    },
    getById: (id) => request(`/tasks/${id}`, { method: 'GET' }),
    create: (taskData) => request('/tasks', { method: 'POST', body: JSON.stringify(taskData) }),
    update: (id, updates) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request('/settings', { method: 'GET' }),
    update: (settingsData) => request('/settings', { method: 'PATCH', body: JSON.stringify(settingsData) }),
    uploadProfilePicture: async (formData) => {
      const url = `${BASE_URL}/settings/profile-picture`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(data.message || data.error || `Upload failed with status ${response.status}`);
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return data;
      } catch (err) {
        if (err.status !== undefined) throw err;
        const netErr = new Error('Network error: Unable to upload profile picture to backend.');
        netErr.status = 0;
        throw netErr;
      }
    },
    deleteProfilePicture: () => request('/settings/profile-picture', { method: 'DELETE' }),
  },
  health: {
    check: () => request('/health', { method: 'GET' }),
  },
};

export default api;
