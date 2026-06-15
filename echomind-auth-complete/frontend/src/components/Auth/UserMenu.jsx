// src/components/Auth/UserMenu.jsx
// Drop this into your existing topbar wherever you want the Login/Logout button
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Avatar = ({ user, size = 32 }) => {
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      flexShrink: 0, cursor: 'pointer',
      border: '2px solid rgba(99,102,241,0.4)',
      boxShadow: '0 0 10px rgba(99,102,241,0.3)',
      userSelect: 'none',
    }}>
      {user?.avatarUrl
        ? <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  );
};

export default function UserMenu({ theme = 'dark' }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);

  const T = {
    bg:     theme === 'light' ? '#fff'     : '#1e2130',
    border: theme === 'light' ? '#e2e8f0'  : 'rgba(255,255,255,0.1)',
    text:   theme === 'light' ? '#1e293b'  : '#f1f2f6',
    muted:  theme === 'light' ? '#64748b'  : '#8b91a8',
    hover:  theme === 'light' ? '#f8fafc'  : 'rgba(99,102,241,0.08)',
    btnBg:  theme === 'light' ? '#f1f5f9'  : '#161820',
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  if (loading) {
    return <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.btnBg, border: `1px solid ${T.border}`, animation: 'pulse 1.5s infinite ease-in-out' }} />;
  }

  /* ── Not logged in ── */
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.muted, cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'rgba(99,102,241,0.4)'; e.target.style.color = '#818cf8'; }}
          onMouseLeave={e => { e.target.style.borderColor = T.border; e.target.style.color = T.muted; }}
        >
          Sign In
        </button>
        <button
          onClick={() => navigate('/login?tab=register')}
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: '#6366f1', border: 'none', color: '#fff',
            cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            boxShadow: '0 2px 10px rgba(99,102,241,0.35)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.target.style.opacity = '0.85'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          Sign Up
        </button>
      </div>
    );
  }

  /* ── Logged in ── */
  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar user={user} size={32} />
        <div style={{ textAlign: 'left', display: 'none' }}>
          {/* show on wider topbars if you like */}
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 220, background: T.bg,
          border: `1px solid ${T.border}`, borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
          zIndex: 500, overflow: 'hidden',
          animation: 'dropDown 0.15s ease',
        }}>
          <style>{`@keyframes dropDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* User info */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar user={user} size={36} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
          </div>

          {/* Role badge */}
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: user.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)', color: user.role === 'admin' ? '#f59e0b' : '#818cf8', border: `1px solid ${user.role === 'admin' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.2)'}`, fontWeight: 600, letterSpacing: '0.5px' }}>
              {user.role === 'admin' ? '⭐ Admin' : '👤 User'}
            </span>
          </div>

          {/* Menu items */}
          {[
            { icon: '⚙️', label: 'Settings', onClick: () => { navigate('/settings'); setOpen(false); } },
            { icon: '📜', label: 'History',  onClick: () => { navigate('/history');  setOpen(false); } },
          ].map(({ icon, label, onClick }) => (
            <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <span>{icon}</span> {label}
            </button>
          ))}

          <div style={{ height: 1, background: T.border, margin: '4px 0' }} />

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: loggingOut ? T.muted : '#f43f5e', fontSize: 13, cursor: loggingOut ? 'not-allowed' : 'pointer', fontFamily: "'Outfit', sans-serif", textAlign: 'left', transition: 'background 0.1s' }}
            onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            {loggingOut
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(244,63,94,0.2)', borderTopColor: '#f43f5e', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} /> Signing out…</>
              : <><span>🚪</span> Sign Out</>
            }
          </button>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  );
}
