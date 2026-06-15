// ════════════════════════════════════════════════════════════════════════════
// HOW TO ADD LOGIN/LOGOUT BUTTON TO YOUR EXISTING chatpage.jsx (Vox/EchoMind)
// ════════════════════════════════════════════════════════════════════════════
//
// STEP 1 — Add import at top of chatpage.jsx (after existing imports):
//
//   import UserMenu from './components/Auth/UserMenu';
//   import { useAuth } from './context/AuthContext';
//
// ────────────────────────────────────────────────────────────────────────────
// STEP 2 — Inside your ChatPage component, add this line near the top:
//
//   const { user } = useAuth();
//
// ────────────────────────────────────────────────────────────────────────────
// STEP 3 — In your Topbar JSX, find the right-side buttons div:
//
//   BEFORE (your existing right buttons):
//   ┌────────────────────────────────────────────────────────────────────┐
//   │  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>  │
//   │    <button onClick={() => setTheme(...)}>☀️</button>              │
//   │    <div style={{ position: 'relative' }}>  {/* export menu */}    │
//   │    {isSpeaking && <button onClick={stopAudio}>■</button>}         │
//   │    <button onClick={requestDeleteConversation}>🗑</button>         │
//   │  </div>                                                            │
//   └────────────────────────────────────────────────────────────────────┘
//
//   AFTER — add <UserMenu theme={theme} /> at the END of that div:
//   ┌────────────────────────────────────────────────────────────────────┐
//   │  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>  │
//   │    <button onClick={() => setTheme(...)}>☀️</button>              │
//   │    <div style={{ position: 'relative' }}>  {/* export menu */}    │
//   │    {isSpeaking && <button onClick={stopAudio}>■</button>}         │
//   │    <button onClick={requestDeleteConversation}>🗑</button>         │
//   │                                                                    │
//   │    {/* ↓ ADD THIS LINE ↓ */}                                      │
//   │    <UserMenu theme={theme} />                                      │
//   │                                                                    │
//   │  </div>                                                            │
//   └────────────────────────────────────────────────────────────────────┘
//
// ────────────────────────────────────────────────────────────────────────────
// STEP 4 — Optionally show user's name in the status bar. Find:
//
//   <div style={{ fontSize: 11, color: '#10b981', ... }}>
//     {isSpeaking ? 'Speaking…' : isListening ? 'Listening…' : ...}
//   </div>
//
//   Add AFTER it:
//   {user && (
//     <div style={{ fontSize: 10, color: '#3d4260', marginTop: 1 }}>
//       👤 {user.name}
//     </div>
//   )}
//
// ════════════════════════════════════════════════════════════════════════════

// That's it! The UserMenu component handles:
//   - Shows "Sign In" + "Sign Up" buttons when logged out
//   - Shows avatar + dropdown when logged in
//   - Dropdown has: user name, email, role badge, Settings, History, Sign Out
//   - Logout calls backend, clears JWT, redirects to /login
