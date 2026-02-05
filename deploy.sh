#!/bin/bash

# AMI One-on-One Deployment Script
# Run this on your AWS server: bash deploy.sh

echo "🚀 Starting deployment..."

# Navigate to app directory
cd /var/www/oneonone || exit

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Check if .env exists, if not create from template
if [ ! -f .env ]; then
  echo "📝 Creating .env file from template..."
  echo "⚠️  Please edit .env with your actual credentials!"
  cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://amiuser:YOUR_DB_PASSWORD@localhost:5432/ami_oneonone"

# NextAuth
NEXTAUTH_SECRET="generate-a-random-secret-key"
NEXTAUTH_URL="https://your-domain.com"
NODE_ENV="production"

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI (optional - can be set in app settings)
OPENAI_API_KEY=""
EOF
  echo "❌ .env created but needs configuration. Please edit it and run deploy.sh again."
  exit 1
else
  echo "✅ .env file exists, using existing configuration"
fi

# Install dependencies (if needed)
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️ Pushing database schema..."
npx prisma db push

# Build the app
echo "🏗️ Building app (this may take a few minutes)..."
NODE_OPTIONS="--max-old-space-size=3072" npm run build

# Seed database with test data
echo "🌱 Seeding database..."
npx prisma db seed || true

# Restart PM2
echo "🔄 Restarting app..."
pm2 restart oneonone || pm2 start npm --name "oneonone" -- start
pm2 save

echo ""
echo "✅ Deployment complete!"
echo "🌐 App URL: set NEXTAUTH_URL in .env (e.g. https://oneonone.wliq.ai)"
echo "📋 SSL: see deploy/SSL-SETUP.md and use deploy/nginx-ssl.conf on this server"
echo ""
