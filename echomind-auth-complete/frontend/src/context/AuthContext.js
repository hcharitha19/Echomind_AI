// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({
  baseURL:     process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true,           // send httpOnly cookies
  timeout:     15000,
});

// Auto-attach access token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401 TOKEN_EXPIRED
let isRefreshing = false;
let failedQueue  = [];
const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    if (
      err.response?.status === 401 &&
      err.response?.data?.code === 'TOKEN_EXPIRED' &&
      !orig._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            orig.headers.Authorization = `Bearer ${token}`;
            return API(orig);
          })
          .catch(Promise.reject);
      }
      orig._retry  = true;
      isRefreshing = true;
      try {
        const { data } = await API.post('/auth/refresh');
        const newToken = data.accessToken;
        localStorage.setItem('accessToken', newToken);
        API.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        orig.headers.Authorization = `Bearer ${newToken}`;
        return API(orig);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);   // initial check
  const [error,   setError]   = useState(null);
  const initialized = useRef(false);

  /* ── Bootstrap: restore session ─────────────────────── */
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const restore = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await API.get('/auth/me');
        if (data.success) setUser(data.user);
      } catch (_) {
        localStorage.removeItem('accessToken');
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  /* ── Register ─────────────────────────────────────────── */
  const register = useCallback(async (name, email, password) => {
    setError(null);
    try {
      const { data } = await API.post('/auth/register', { name, email, password });
      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        setUser(data.user);
        return { success: true };
      }
      throw new Error(data.message);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed.';
      setError(msg);
      return { success: false, message: msg };
    }
  }, []);

  /* ── Login ────────────────────────────────────────────── */
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const { data } = await API.post('/auth/login', { email, password });
      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        setUser(data.user);
        return { success: true };
      }
      throw new Error(data.message);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed.';
      setError(msg);
      return { success: false, message: msg };
    }
  }, []);

  /* ── Logout ───────────────────────────────────────────── */
  const logout = useCallback(async () => {
    try {
      await API.post('/auth/logout');
    } catch (_) { /* ignore */ }
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  /* ── Update profile ───────────────────────────────────── */
  const updateProfile = useCallback(async (updates) => {
    try {
      const { data } = await API.put('/auth/profile', updates);
      if (data.success) { setUser(data.user); return { success: true }; }
      return { success: false, message: data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed.' };
    }
  }, []);

  /* ── Change password ──────────────────────────────────── */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const { data } = await API.put('/auth/change-password', { currentPassword, newPassword });
      return data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed.' };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, error,
      isAuthenticated: !!user,
      register, login, logout,
      updateProfile, changePassword,
      clearError: () => setError(null),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export { API };
