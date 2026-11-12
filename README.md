# SQC - Statistical Quality Control Management System
**Target OS:** Ubuntu Linux Server / Linux | **Database:** PostgreSQL (`"IT SQC"`) | **Port:** `3001`

A production-grade Statistical Quality Control (SQC) web system engineered for isolated, zero-conflict hosting on **Ubuntu Server** alongside other web applications and databases.

---

## 1. Multi-App Co-existence & Non-Interference Architecture

When hosting on an Ubuntu Server running multiple existing web applications:

| Isolation Layer | Protection Strategy |
|---|---|
| **Database Isolation** | Uses a dedicated, quoted database name `"IT SQC"`. Does **not** touch or alter any other PostgreSQL databases. |
| **Port Isolation** | Binds strictly to **Port 3001** (or any port configured in `.env`), preventing conflicts with apps on Port 80, 443, 3000, 8080, etc. |
| **Process Isolation** | Runs as an independent Systemd background service (`sqc.service`) or PM2 process (`sqc-server`), isolated from other Node/Python/PHP services. |
| **Reverse Proxy (Nginx)** | Can be mapped cleanly to a dedicated subdomain (e.g. `sqc.yourdomain.com`) or port path in Nginx without disturbing other Nginx virtual hosts (`/etc/nginx/sites-available/`). |

---

## 2. Quick One-Command Setup on Ubuntu Server

Open terminal on your Ubuntu server and run:

```bash
sudo bash setup_ubuntu_service.sh
```

This automated script will:
1. Create isolated directory `/var/www/sqc`.
2. Install npm dependencies cleanly.
3. Execute `setup-db.js` to create `"IT SQC"` database and seed master tables.
4. Build the production React frontend bundle into `/var/www/sqc/dist`.
5. Register and start `/etc/systemd/system/sqc.service` (auto-restarts on reboot).

---

## 3. Step-by-Step Manual Ubuntu Installation Guide

### Step 1: Clone or Copy Project to Ubuntu
```bash
sudo mkdir -p /var/www/sqc
sudo cp -r . /var/www/sqc/
cd /var/www/sqc
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update parameters in `.env`:
```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=IT SQC
DB_USER=postgres
DB_PASSWORD=your_ubuntu_postgres_password

API_KEY=change-this-to-a-long-secret-key-123456
JWT_SECRET=bjcl-sqc-jwt-secret-2026-quality-control
```

### Step 3: Initialize Database `"IT SQC"`
```bash
node setup-db.js
```
*Creates database `"IT SQC"`, creates all 10 schema tables, foreign keys, indexes, and initial admin account (`admin` / `Admin@123456`).*

### Step 4: Build Production Assets & Start Server
```bash
npm install
npm run build
node server.js
```

---

## 4. Ubuntu Systemd Service Setup (Auto-Restart on Reboot)

Create Systemd unit file `/etc/systemd/system/sqc.service`:

```ini
[Unit]
Description=SQC Statistical Quality Control Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/sqc
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DB_HOST=127.0.0.1
Environment=DB_PORT=5432
Environment=DB_NAME=IT SQC
Environment=DB_USER=postgres
Environment=DB_PASSWORD=postgres

[Install]
WantedBy=multi-user.target
```

Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sqc
sudo systemctl start sqc
```

Check status and logs:
```bash
sudo systemctl status sqc
sudo journalctl -u sqc -f
```

---

## 5. Nginx Reverse Proxy Configuration (Multi-App Virtual Host)

Add a new Nginx site in `/etc/nginx/sites-available/sqc`:

```nginx
server {
    listen 80;
    server_name sqc.yourdomain.com; # Or your server IP / domain

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 50M;
}
```

Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/sqc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. UFW Firewall Settings

Allow incoming traffic to Port 3001 or Nginx Port 80:
```bash
sudo ufw allow 3001/tcp
sudo ufw allow 'Nginx Full'
```

---

## 7. Form Coverage (FORM-01 to FORM-37)

The system supports all 38 factory floor quality control forms (FORM-01 to FORM-37), with role-based user management and granular per-form access controls.
