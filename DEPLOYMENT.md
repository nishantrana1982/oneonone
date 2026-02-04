# AWS Deployment Guide

This guide covers deploying the AMI One-on-One application to AWS.

## Prerequisites

- AWS Account
- AWS CLI configured
- Docker installed (for containerization)
- PostgreSQL database (AWS RDS recommended)

## Architecture

- **Application**: Next.js app running on AWS ECS (Fargate) or EC2
- **Database**: PostgreSQL on AWS RDS
- **Email**: AWS SES
- **Storage**: Optional S3 for file uploads

## Step 1: Set Up AWS RDS PostgreSQL

1. Create an RDS PostgreSQL instance:
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier ami-one-on-one-db \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username admin \
     --master-user-password YourSecurePassword \
     --allocated-storage 20 \
     --vpc-security-group-ids sg-xxxxx
   ```

2. Note the endpoint URL for your `DATABASE_URL` environment variable:
   ```
   postgresql://admin:YourSecurePassword@ami-one-on-one-db.xxxxx.us-east-1.rds.amazonaws.com:5432/ami_one_on_one
   ```

## Step 2: Configure AWS SES

1. Verify your sending domain in SES
2. Request production access if in sandbox mode
3. Note your AWS credentials for email sending

## Step 3: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://yourdomain.com/api/auth/callback/google`
4. Note your Client ID and Client Secret

## Step 4: Build and Push Docker Image

```bash
# Build the image
docker build -t ami-one-on-one .

# Tag for ECR
docker tag ami-one-on-one:latest YOUR_ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/ami-one-on-one:latest

# Push to ECR
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
docker push YOUR_ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/ami-one-on-one:latest
```

## Step 5: Deploy to ECS (Fargate)

1. Create ECS cluster:
   ```bash
   aws ecs create-cluster --cluster-name ami-one-on-one
   ```

2. Create task definition (see `ecs-task-definition.json`)

3. Create service:
   ```bash
   aws ecs create-service \
     --cluster ami-one-on-one \
     --service-name ami-one-on-one-service \
     --task-definition ami-one-on-one \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
   ```

## Step 6: Run Database Migrations

```bash
# Connect to your ECS task or use a separate migration container
npx prisma migrate deploy
```

## Step 7: Environment Variables

Set these in your ECS task definition or EC2 instance:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SES_FROM_EMAIL=noreply@yourcompany.com
```

## Step 8: Set Up Load Balancer (Optional)

For production, use an Application Load Balancer:
1. Create ALB in AWS Console
2. Configure target group pointing to your ECS service
3. Set up SSL certificate with ACM
4. Configure DNS to point to ALB

## Alternative: EC2 Deployment

1. Launch EC2 instance (Ubuntu 22.04 LTS recommended)
2. Install Node.js, Docker, and dependencies
3. Clone repository and build
4. Set up PM2 or systemd service
5. Configure Nginx as reverse proxy
6. Set up SSL with Let's Encrypt

## Monitoring

- Set up CloudWatch logs for application logs
- Configure CloudWatch alarms for errors
- Set up health check endpoint: `/api/health`

## Backup Strategy

- Enable automated RDS backups
- Set up daily database snapshots
- Consider S3 backups for important data

## Security

- Use AWS Secrets Manager for sensitive credentials
- Enable VPC for database isolation
- Configure security groups properly
- Use IAM roles instead of access keys where possible
- Enable CloudTrail for audit logging
