# ═══════════════════════════════════════════════════════════════
#  EchoMind AI — Production Deployment Guide
# ═══════════════════════════════════════════════════════════════

## 1. PREREQUISITES (Ubuntu 22.04 / any VPS)
```bash
sudo apt update && sudo apt install -y nodejs npm mysql-server nginx certbot python3-certbot-nginx
node -v   # need v18+
npm -v
```

## 2. MYSQL SETUP
```sql
sudo mysql -u root
CREATE DATABASE echomind_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'echomind'@'localhost' IDENTIFIED BY 'StrongPass123!';
GRANT ALL PRIVILEGES ON echomind_db.* TO 'echomind'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. BACKEND SETUP
```bash
cd /var/www/echomind/backend
cp .env.example .env
nano .env   # Fill in DB_PASSWORD, JWT_SECRET (min 32 chars), etc.
npm install
node config/migrate.js     # creates all tables
npm start                  # or use PM2 (recommended)
```

## 4. PM2 (Process Manager — keeps server running)
```bash
npm install -g pm2
cd /var/www/echomind/backend
pm2 start server.js --name echomind-api
pm2 startup
pm2 save

# Useful commands:
pm2 logs echomind-api      # view logs
pm2 restart echomind-api   # restart
pm2 status                 # check status
```

## 5. FRONTEND BUILD
```bash
cd /var/www/echomind/frontend
cp .env.example .env.production.local
# Set REACT_APP_API_URL=https://yourdomain.com/api
npm install
npm run build              # creates /build folder
```

## 6. NGINX CONFIG (/etc/nginx/sites-available/echomind)
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # React frontend
    root /var/www/echomind/frontend/build;
    index index.html;

    # API proxy to Node backend
    location /api/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 25M;
    }

    # React SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/echomind /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 7. SSL CERTIFICATE (free HTTPS)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Certbot auto-updates your nginx config with HTTPS
```

## 8. ENVIRONMENT VARIABLES (.env for production)
```
NODE_ENV=production
PORT=5000
JWT_SECRET=<generate: openssl rand -base64 48>
JWT_REFRESH_SECRET=<generate: openssl rand -base64 48>
DB_HOST=localhost
DB_USER=echomind
DB_PASSWORD=StrongPass123!
DB_NAME=echomind_db
CLIENT_URL=https://yourdomain.com
OLLAMA_URL=http://localhost:11434
```

## 9. OLLAMA SETUP (if not installed)
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3
ollama serve   # runs on :11434
# Keep running with: systemctl enable ollama
```

## 10. FOLDER STRUCTURE
```
/var/www/echomind/
├── backend/
│   ├── server.js
│   ├── .env
│   ├── config/
│   ├── routes/
│   └── middleware/
└── frontend/
    ├── src/
    └── build/        ← served by Nginx
```

## QUICK HEALTH CHECK
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok","env":"production"}
```
