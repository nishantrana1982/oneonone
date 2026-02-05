# SSL Setup for oneonone.wliq.ai

Do this **once** on your server after Certbot has issued the certificate.

## One-shot (recommended)

From the app directory on the server:

```bash
cd /var/www/oneonone
git pull
bash deploy/setup-ssl-on-server.sh
```

The script copies the SSL config to both `sites-available/default` and `sites-available/oneonone`, so it works whether Nginx has `default` or `oneonone` enabled in `sites-enabled`.

Then open **port 443** in AWS Security Group (Inbound → HTTPS, 443, 0.0.0.0/0), set `NEXTAUTH_URL=https://oneonone.wliq.ai` in `.env`, and run `pm2 restart oneonone`.

---

## Manual steps (if you prefer)

### 1. Copy Nginx config from repo

```bash
cd /var/www/oneonone
sudo cp deploy/nginx-ssl.conf /etc/nginx/sites-available/default
```

### 2. Test and **restart** Nginx (restart is required for 443 to bind; reload may not add the port)

```bash
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl restart nginx
```

### 3. Confirm Nginx is listening on 443

```bash
sudo ss -tlnp | grep -E ':80|:443'
```

You should see both `:80` and `:443`. If only `:80` appears, check:

- Certificate files exist: `sudo ls /etc/letsencrypt/live/oneonone.wliq.ai/`
- Nginx error log: `sudo tail -20 /var/log/nginx/error.log`

### 4. Set app URL and restart app

```bash
cd /var/www/oneonone
# Edit .env: set NEXTAUTH_URL=https://oneonone.wliq.ai and NODE_ENV=production
nano .env
pm2 restart oneonone
```

### 5. Open port 443

- **AWS EC2**: Security Groups → your instance’s group → Inbound rules → Add: Type **HTTPS**, Port **443**, Source **0.0.0.0/0**
- **UFW** (if active): `sudo ufw allow 443/tcp && sudo ufw reload`

### 6. Test

Open **https://oneonone.wliq.ai** in a browser and confirm the padlock.
