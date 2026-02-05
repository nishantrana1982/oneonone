# Email via SMTP (use your own email)

The app can send meeting and to-do notifications using your own email account via SMTP. If SMTP is configured, it is used; otherwise AWS SES is used (if configured).

## Gmail

1. **Enable 2-Step Verification**  
   Google Account → Security → 2-Step Verification → turn on.

2. **Create an App Password**  
   Google Account → Security → 2-Step Verification → App passwords → generate a new app password (choose “Mail” and your device). Copy the 16-character password.

3. **Add to server `.env`** (e.g. `/var/www/oneonone/.env`):
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
   EMAIL_FROM="your-email@gmail.com"
   ```
   Use the 16-character app password (spaces are optional).

4. Restart the app: `pm2 restart oneonone`.

## Outlook / Microsoft 365

- **SMTP_HOST:** `smtp.office365.com`  
- **SMTP_PORT:** `587`  
- **SMTP_USER:** your full email (e.g. `you@company.com`)  
- **SMTP_PASSWORD:** your normal account password (or app password if 2FA is on)  
- **EMAIL_FROM:** same as SMTP_USER  

Add these to `.env` and restart the app.

## Other providers

Use your provider’s SMTP host and port (e.g. 587 for TLS, 465 for SSL). Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` in `.env`.

## Required variables

| Variable         | Description                    |
|-----------------|--------------------------------|
| SMTP_HOST       | SMTP server (e.g. smtp.gmail.com) |
| SMTP_PORT       | Usually 587 (TLS) or 465 (SSL) |
| SMTP_USER       | Your email address             |
| SMTP_PASSWORD   | Password or app password       |
| EMAIL_FROM      | From address (usually same as SMTP_USER) |

If any of these are missing, the app will not use SMTP and will fall back to AWS SES if that is configured; otherwise no email is sent.
