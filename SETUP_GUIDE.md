# Setup Guide - Step by Step

Follow these steps to get your AMI One-on-One system up and running.

## Step 1: Database Setup ✅ (Choose one option)

### Option A: Local PostgreSQL (for development)

1. **Install PostgreSQL** (if not already installed):
   - macOS: `brew install postgresql@14`
   - Or download from: https://www.postgresql.org/download/

2. **Start PostgreSQL**:
   ```bash
   brew services start postgresql@14
   ```

3. **Create database**:
   ```bash
   createdb ami_one_on_one
   ```

4. **Update .env file**:
   ```
   DATABASE_URL="postgresql://your_username@localhost:5432/ami_one_on_one?schema=public"
   ```
   (Replace `your_username` with your macOS username)

### Option B: Cloud Database (Supabase - Free tier)

1. Go to https://supabase.com
2. Sign up for free account
3. Create a new project
4. Go to Settings → Database
5. Copy the connection string
6. Update `.env` with the connection string

### Option C: AWS RDS (for production)

1. Go to AWS Console → RDS
2. Create PostgreSQL database
3. Note the endpoint
4. Update `.env` with connection string

---

## Step 2: Run Database Migrations

After setting up your database, run:

```bash
npx prisma db push
```

This will create all the tables in your database.

---

## Step 3: Google OAuth Setup

### 3.1 Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click "Create Project"
3. Name it "AMI One-on-One" (or any name)
4. Click "Create"

### 3.2 Enable Google+ API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click "Enable"

### 3.3 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: Internal (for Google Workspace) or External
   - App name: "AMI One-on-One"
   - User support email: your email
   - Developer contact: your email
   - Click "Save and Continue"
   - Scopes: Just click "Save and Continue"
   - Test users: Add your email, click "Save and Continue"
   - Click "Back to Dashboard"

4. Create OAuth Client ID:
   - Application type: "Web application"
   - Name: "AMI One-on-One Web Client"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - (For production, add your production URL)
   - Click "Create"
   - **Copy the Client ID and Client Secret**

5. **Update .env file**:
   ```
   GOOGLE_CLIENT_ID="paste-your-client-id-here"
   GOOGLE_CLIENT_SECRET="paste-your-client-secret-here"
   GOOGLE_WORKSPACE_DOMAIN="yourcompany.com"
   ```
   (Replace `yourcompany.com` with your actual company domain)

### 3.4 Enable Google Calendar API (for calendar integration)

1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click "Enable"
4. Use the same OAuth credentials created above, or create separate ones
5. Update `.env`:
   ```
   GOOGLE_CALENDAR_CLIENT_ID="same-as-above-or-separate"
   GOOGLE_CALENDAR_CLIENT_SECRET="same-as-above-or-separate"
   ```

---

## Step 4: AWS SES Setup (Optional - for email notifications)

### 4.1 Create AWS Account (if needed)

1. Go to https://aws.amazon.com/
2. Sign up for free tier account

### 4.2 Verify Email Domain

1. Go to AWS Console → SES
2. Click "Verified identities" → "Create identity"
3. Choose "Domain" or "Email address"
4. Follow verification steps

### 4.3 Create IAM User for SES

1. Go to IAM → Users → "Create user"
2. Name: "ami-one-on-one-ses"
3. Attach policy: "AmazonSESFullAccess" (or create custom policy)
4. Create access key
5. **Copy Access Key ID and Secret Access Key**

6. **Update .env file**:
   ```
   AWS_REGION="us-east-1"
   AWS_ACCESS_KEY_ID="your-access-key"
   AWS_SECRET_ACCESS_KEY="your-secret-key"
   AWS_SES_FROM_EMAIL="noreply@yourcompany.com"
   ```

**Note**: If you're in SES sandbox mode, you can only send to verified emails. Request production access for full functionality.

---

## Step 5: Test the Setup

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open browser**: http://localhost:3000

3. **Test login**: Try signing in with your Google Workspace account

---

## Step 6: Create First Admin User

After logging in for the first time, you'll need to manually set your role in the database:

1. **Connect to your database**:
   ```bash
   npx prisma studio
   ```
   This opens a web interface to view/edit your database.

2. **Or use SQL**:
   ```sql
   UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'your-email@yourcompany.com';
   ```

---

## Troubleshooting

### Database Connection Issues
- Check if PostgreSQL is running: `brew services list`
- Verify connection string format
- Check database exists: `psql -l`

### Google OAuth Issues
- Verify redirect URI matches exactly
- Check OAuth consent screen is configured
- Ensure Google+ API is enabled
- Verify domain restriction in code matches your domain

### Email Not Working
- Check AWS SES is out of sandbox mode
- Verify email domain is verified
- Check AWS credentials are correct
- Review CloudWatch logs for errors

---

## Next Steps After Setup

1. Create departments in Admin panel
2. Add employees/users
3. Set up reporting hierarchy
4. Schedule your first meeting!

Need help? Check the main README.md or deployment docs.
