// src/App.js  — Drop-in replacement for your existing App.js
// Adds AuthProvider + Login route + ProtectedRoute wrapper

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, GuestRoute } from './components/Auth/ProtectedRoute';
import AuthPage from './components/Auth/AuthPage';

// Lazy-load the main chat app for code splitting
const ChatPage = lazy(() => import('./pages/ChatPage'));

const Spinner = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090d' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #1e2130', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public: Login / Register */}
            <Route path="/login" element={
              <GuestRoute><AuthPage /></GuestRoute>
            } />

            {/* Protected: all app routes */}
            <Route path="/chat" element={
              <ProtectedRoute><ChatPage /></ProtectedRoute>
            } />
            <Route path="/chat/:sessionId" element={
              <ProtectedRoute><ChatPage /></ProtectedRoute>
            } />

            {/* Redirect root based on auth */}
            <Route path="/" element={<Navigate to="/chat" replace />} />

            {/* 404 */}
            <Route path="*" element={
              <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#08090d', gap: 12, fontFamily: "'Outfit', sans-serif" }}>
                <div style={{ fontSize: 48 }}>🌌</div>
                <h1 style={{ color: '#f1f2f6', fontSize: 20, fontWeight: 600 }}>Page not found</h1>
                <a href="/chat" style={{ color: '#818cf8', fontSize: 13 }}>← Back to chat</a>
              </div>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
