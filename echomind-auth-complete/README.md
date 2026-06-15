# EchoMind AI — Auth Integration Guide

## Files You Get

```
echomind-auth/
├── backend/
│   ├── server.js              ← Main Express server (production)
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   ├── db.js              ← MySQL pool + retry
│   │   └── migrate.js         ← Creates all DB tables
│   ├── middleware/
│   │   └── auth.js            ← JWT verify middleware
│   └── routes/
│       └── auth.js            ← Register/Login/Logout/Refresh/Me
│
└── frontend/src/
    ├── App.js                 ← Updated App with auth routing
    ├── context/
    │   └── AuthContext.js     ← React auth state + auto-refresh
    └── components/Auth/
        ├── AuthPage.jsx       ← Beautiful Login/Register UI
        ├── UserMenu.jsx       ← Avatar + dropdown in topbar
        └── ProtectedRoute.jsx ← Route guards

```

---

## SETUP IN 5 STEPS

### Step 1 — Copy files into your project
```
Echomind_AI/
├── backend/             ← copy backend files here
└── frontend/src/        ← copy frontend files here
```

### Step 2 — Install backend deps
```bash
cd backend
npm install
```

### Step 3 — Setup .env
```bash
cp .env.example .env
# Edit: DB_PASSWORD, JWT_SECRET (32+ chars), JWT_REFRESH_SECRET
```

### Step 4 — Run migrations
```bash
node config/migrate.js
# Creates: users, refresh_tokens, chat_sessions, messages, login_logs
```

### Step 5 — Integrate UserMenu into chatpage.jsx
```jsx
// Add these 2 imports to chatpage.jsx:
import UserMenu from './components/Auth/UserMenu';
import { useAuth } from './context/AuthContext';

// Add inside ChatPage component:
const { user } = useAuth();

// Add to topbar JSX (right side buttons):
<UserMenu theme={theme} />
```

---

## API ENDPOINTS

| Method | Endpoint                 | Auth | Description           |
|--------|--------------------------|------|-----------------------|
| POST   | /api/auth/register       | ❌   | Create account        |
| POST   | /api/auth/login          | ❌   | Sign in               |
| POST   | /api/auth/logout         | ✅   | Sign out              |
| POST   | /api/auth/refresh        | ❌   | Refresh access token  |
| GET    | /api/auth/me             | ✅   | Get current user      |
| PUT    | /api/auth/profile        | ✅   | Update name/avatar    |
| PUT    | /api/auth/change-password| ✅   | Change password       |

---

## SECURITY FEATURES
- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ JWT access tokens (7d) + refresh tokens (30d)
- ✅ Refresh token rotation (old token deleted on each refresh)
- ✅ httpOnly cookies for refresh tokens
- ✅ Rate limiting: 20 login attempts / 15 min
- ✅ Helmet security headers
- ✅ SQL injection prevention (parameterized queries)
- ✅ Input validation with express-validator
- ✅ Login audit log (IP, user-agent, success/fail)
- ✅ Auto token refresh on 401 (transparent to user)
- ✅ CORS locked to your CLIENT_URL

---

## DATABASE TABLES
- **users** — id, name, email, password_hash, role, is_active, last_login
- **refresh_tokens** — token rotation store
- **chat_sessions** — per-user conversation storage
- **messages** — individual messages per session
- **login_logs** — audit trail (IP, user-agent, status)
