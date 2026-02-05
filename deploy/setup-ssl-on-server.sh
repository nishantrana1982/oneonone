#!/bin/bash
# Run from app root: cd /var/www/oneonone && bash deploy/setup-ssl-on-server.sh
# Copies Nginx SSL config and restarts Nginx so it listens on 443.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_ROOT"

CONF_SOURCE="$APP_ROOT/deploy/nginx-ssl.conf"
# Copy to both: default and oneonone (server may have either in sites-enabled)
NGINX_SITES="/etc/nginx/sites-available/default /etc/nginx/sites-available/oneonone"

if [ ! -f "$CONF_SOURCE" ]; then
  echo "❌ Not found: $CONF_SOURCE (run from app root: /var/www/oneonone)"
  exit 1
fi

echo "📋 Copying Nginx SSL config to default and oneonone..."
for target in $NGINX_SITES; do
  if [ -d "$(dirname "$target")" ]; then
    sudo cp "$CONF_SOURCE" "$target" && echo "   -> $target" || true
  fi
done

echo "🔍 Testing Nginx config..."
sudo nginx -t

echo "🔄 Reloading systemd and restarting Nginx (restart required for 443 to bind)..."
sudo systemctl daemon-reload
sudo systemctl restart nginx

echo "📡 Checking ports..."
if sudo ss -tlnp | grep -q ':443'; then
  echo "✅ Nginx is listening on 443."
else
  echo "⚠️  Port 443 not in list. Run: sudo ss -tlnp | grep -E ':80|:443'"
  echo "   If only :80 appears, check: sudo tail -20 /var/log/nginx/error.log"
fi

echo ""
echo "Next:"
echo "  1. AWS Security Group → Inbound → Add HTTPS (443) from 0.0.0.0/0 if not already."
echo "  2. In .env set NEXTAUTH_URL=https://oneonone.wliq.ai and NODE_ENV=production"
echo "  3. pm2 restart oneonone"
echo "  4. Open https://oneonone.wliq.ai in browser"
