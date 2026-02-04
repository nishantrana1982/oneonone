# AMI One-on-One Meeting Management System

A web application to manage bi-weekly one-on-one meetings following the AMI Agency Advantage system.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (AWS RDS)
- **ORM**: Prisma
- **Authentication**: NextAuth.js with Google Workspace
- **Calendar**: Google Calendar API
- **Email**: AWS SES
- **Hosting**: AWS (EC2/ECS + RDS)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth-related pages
│   ├── (dashboard)/       # Protected dashboard pages
│   ├── api/               # API routes
│   └── layout.tsx
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── forms/            # Form components
│   └── layouts/          # Layout components
├── lib/                   # Utilities and helpers
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # Auth utilities
│   └── google-calendar.ts # Calendar API
├── types/                 # TypeScript types
└── styles/               # Global styles
├── prisma/
│   └── schema.prisma     # Database schema
```
