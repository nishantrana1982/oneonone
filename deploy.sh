#!/bin/bash

# AMI One-on-One Deployment Script
# Run this on your AWS server: bash deploy.sh

echo "🚀 Starting deployment..."

# Navigate to app directory
cd /var/www/oneonone || exit

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Create .env file with correct values
echo "📝 Creating .env file..."
cat > .env << 'EOF'
DATABASE_URL="postgresql://amiuser:AmiSecure2026@localhost:5432/ami_oneonone"
NEXTAUTH_SECRET="ami-oneonone-super-secret-key-2026"
NEXTAUTH_URL="http://13.127.6.212.nip.io"
NODE_ENV="development"
GOOGLE_CLIENT_ID="1035016968012-7jh1s9hqqag8q33lj2r971b60sug5vfg.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"
OPENAI_API_KEY=""
EOF

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
echo "🌐 Open: http://13.127.6.212.nip.io"
echo ""
