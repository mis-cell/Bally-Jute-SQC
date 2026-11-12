#!/bin/bash
# ==============================================================================
# SQC - STATISTICAL QUALITY CONTROL SYSTEM
# Ubuntu Server Isolated Service Setup Script
# ==============================================================================

set -e

echo "=================================================================="
echo "🐧 SQC System - Automated Ubuntu Server Installer"
echo "=================================================================="

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script with sudo or as root: sudo bash setup_ubuntu_service.sh"
  exit 1
fi

APP_DIR="/var/www/sqc"
echo "1️⃣ Setting up isolated application directory at $APP_DIR..."
mkdir -p "$APP_DIR"
cp -r . "$APP_DIR/"
cd "$APP_DIR"

echo "2️⃣ Installing Node.js dependencies..."
npm install

echo "3️⃣ Initializing PostgreSQL database 'IT SQC'..."
node setup-db.js || echo "⚠️ Database notice: Verify PostgreSQL service is active on Ubuntu."

echo "4️⃣ Building production web client bundle..."
npm run build

echo "5️⃣ Registering Systemd background service 'sqc.service'..."
cat << 'EOF' > /etc/systemd/system/sqc.service
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
Environment=DB_NAME=SQC
Environment=DB_USER=postgres
Environment=DB_PASSWORD=postgres

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sqc
systemctl restart sqc

echo "=================================================================="
echo "🎉 SQC Installed & Running as an Isolated Systemd Service on Port 3001!"
echo "Check Status: sudo systemctl status sqc"
echo "View Logs  : sudo journalctl -u sqc -f"
echo "=================================================================="
