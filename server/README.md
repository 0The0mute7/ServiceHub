f# ServiceHub Backend

Node.js and Express API for ServiceHub.

## Setup

Install dependencies:

```powershell
npm.cmd install
```

Create `.env` from `.env.example` and update `DATABASE_URL` with your Neon PostgreSQL connection string:

```txt
PORT=5000
JWT_SECRET=replace_with_a_long_random_secret
DATABASE_URL="postgresql://USER:PASSWORD@HOST/servicehub?sslmode=require"
```

In Neon, create a project/database named `servicehub`, then copy the Prisma/PostgreSQL connection string from the dashboard. Keep `sslmode=require` in the URL.

Generate Prisma Client:

```powershell
npm.cmd run prisma:generate
```

Run the first migration after your Neon `DATABASE_URL` is saved:

```powershell
npm.cmd run prisma:migrate
```

Start the server:

```powershell
npm.cmd run dev
```

## Routes

```txt
GET    /
POST   /api/auth/register
POST   /api/auth/login
GET    /api/services
GET    /api/services/:id
POST   /api/services
PUT    /api/services/:id
DELETE /api/services/:id
```

Protected service routes require:

```txt
Authorization: Bearer YOUR_TOKEN
```
