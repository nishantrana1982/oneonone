// PM2 config: run from repo root so "next start" finds .next in the same directory.
// Usage: from app dir run: pm2 start ecosystem.config.cjs  (or pm2 restart ecosystem.config.cjs)
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'oneonone',
      cwd: path.join(__dirname),
      script: 'npm',
      args: 'run start',
      env: { NODE_ENV: 'production' },
    },
  ],
};
