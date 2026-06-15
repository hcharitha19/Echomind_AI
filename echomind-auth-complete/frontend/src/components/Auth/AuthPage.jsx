// src/components/Auth/AuthPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ── tiny helpers ── */
const EYE  = ({ show }) => show ? '👁' : '🙈';
const LOGO = () => (
  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}>
    V
  </div>
);

const InputField = ({ label, type, value, onChange, placeholder, error, icon, onToggleShow, showToggle }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8b91a8', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.5 }}>{icon}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'name'}
        style={{
          width: '100%', padding: '12px 44px 12px 40px',
          background: '#0f1117', border: `1px solid ${error ? 'rgba(244,63,94,0.5)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 10, color: '#f1f2f6', fontSize: 14,
          fontFamily: "'Outfit', sans-serif", outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
        onBlur={e  => { e.target.style.borderColor = error ? 'rgba(244,63,94,0.5)' : 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
      />
      {showToggle && (
        <button type="button" onClick={onToggleShow} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>
          <EYE show={type === 'text'} />
        </button>
      )}
    </div>
    {error && <div style={{ fontSize: 11, color: '#f43f5e', marginTop: 5 }}>⚠ {error}</div>}
  </div>
);

const StrengthBar = ({ password }) => {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score  = checks.filter(Boolean).length;
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  if (!password) return null;
  return (
    <div style={{ marginTop: -8, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score - 1] : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: colors[score - 1] || '#8b91a8' }}>
        {password ? labels[score - 1] || 'Too short' : ''}
      </div>
    </div>
  );
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, loading, clearError } = useAuth();

  const [mode,      setMode]      = useState('login');   // 'login' | 'register'
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErr,  setServerErr]  = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldErrs,  setFieldErrs]  = useState({});

  useEffect(() => { if (isAuthenticated) navigate('/chat', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => { setFieldErrs({}); setServerErr(''); setSuccessMsg(''); clearError(); }, [mode]);

  const validate = () => {
    const errs = {};
    if (mode === 'register' && name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (mode === 'register' && !/[A-Z]/.test(password)) errs.password = 'Include at least one uppercase letter.';
    if (mode === 'register' && !/[0-9]/.test(password)) errs.password = 'Include at least one number.';
    if (mode === 'register' && password !== confirm) errs.confirm = 'Passwords do not match.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerErr(''); setSuccessMsg('');
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrs(errs); return; }
    setFieldErrs({});
    setSubmitting(true);
    try {
      const result = mode === 'login'
        ? await login(email, password)
        : await register(name.trim(), email, password);

      if (result.success) {
        setSuccessMsg(mode === 'login' ? 'Welcome back! Redirecting…' : 'Account created! Redirecting…');
        setTimeout(() => navigate('/chat', { replace: true }), 800);
      } else {
        setServerErr(result.message || 'Something went wrong.');
      }
    } catch (err) {
      setServerErr('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090d' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #1e2130', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08090d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #0f1117 inset !important; -webkit-text-fill-color: #f1f2f6 !important; }
      `}</style>

      {/* BG orbs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', top: '-100px', right: '-100px' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', bottom: '-80px', left: '-80px' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, animation: 'fadeUp 0.4s ease', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><LOGO /></div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f2f6', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ fontSize: 14, color: '#8b91a8', margin: 0 }}>
            {mode === 'login' ? 'Sign in to continue to EchoMind AI' : 'Start chatting with EchoMind for free'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '32px 28px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#08090d', borderRadius: 10, padding: 4, marginBottom: 26 }}>
            {['login', 'register'].map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, background: mode === m ? '#6366f1' : 'transparent', color: mode === m ? '#fff' : '#8b91a8', transition: 'all 0.2s' }}>
                {m === 'login' ? '🔑 Sign In' : '✨ Sign Up'}
              </button>
            ))}
          </div>

          {/* Server error */}
          {serverErr && (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#fb7185', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> {serverErr}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#10b981', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span> {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <InputField label="Full Name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" error={fieldErrs.name} icon="👤" />
            )}
            <InputField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" error={fieldErrs.email} icon="✉️" />
            <InputField label="Password" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" error={fieldErrs.password} icon="🔒" showToggle onToggleShow={() => setShowPass(v => !v)} />
            {mode === 'register' && <StrengthBar password={password} />}
            {mode === 'register' && (
              <InputField label="Confirm Password" type={showConf ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" error={fieldErrs.confirm} icon="🔒" showToggle onToggleShow={() => setShowConf(v => !v)} />
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '13px', borderRadius: 11, border: 'none',
                background: submitting ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit', sans-serif", marginTop: 6,
                transition: 'opacity 0.2s, transform 0.1s',
                boxShadow: submitting ? 'none' : '0 4px 18px rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!submitting) e.target.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.target.style.opacity = '1'; }}
            >
              {submitting ? (
                <><span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              ) : (
                mode === 'login' ? '🚀 Sign In' : '✨ Create Account'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#3d4260' }}>
              New here?&nbsp;
              <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: "'Outfit', sans-serif" }}>
                Create a free account →
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#3d4260' }}>
          🔒 Your data stays local · Powered by Ollama
        </p>
      </div>
    </div>
  );
}
