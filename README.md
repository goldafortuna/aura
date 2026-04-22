# Aura - Secretary SaaS

Aplikasi internal untuk workflow sekretaris: review dokumen, meeting minutes, agenda planner, task management, dan Academy.

## Tech Stack
- Next.js 14 (App Router + API routes)
- TypeScript
- Turborepo (monorepo)
- Drizzle ORM
- PostgreSQL (Neon/Postgres compatible)
- Clerk (authentication)
- Cloudflare R2 / S3 compatible storage

## Struktur Project
- `apps/web` : aplikasi web utama (frontend + backend routes)

## Requirements
- Node.js `>=20 <21`
- npm atau pnpm

## Setup Lokal
1. Install dependency di root project:
```bash
npm install
```
2. Copy env file:
```bash
cp apps/web/.env.example apps/web/.env.local
```
3. Isi variable di `apps/web/.env.local` sesuai environment.

## Menjalankan Aplikasi
Jalankan dari root monorepo:
```bash
npm run dev
```

## Build dan Start
```bash
npm run build
npm run start
```

## Database Commands
Dari root monorepo:
```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## E2E Test
Dari `apps/web`:
```bash
npm run e2e
```

## Catatan Git
- Repository ini hanya memuat codebase `secretary-saas`.
- File sensitif (`.env*`) dan storage/cache lokal sudah di-ignore.
