# Storage Migration to Cloudflare R2

## Summary

The app now uses an object storage abstraction with two supported providers:

- `cloudflare-r2`
- `local`

The production/default provider is `cloudflare-r2`. `local` is kept only for local development and tests.

## Environment variables

### Cloudflare R2

```env
OBJECT_STORAGE_PROVIDER=cloudflare-r2
OBJECT_STORAGE_BUCKET=documents
R2_BUCKET=documents
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=
```

Notes:

- `R2_ENDPOINT` can be built from `CLOUDFLARE_ACCOUNT_ID`, but setting it explicitly is simplest.
- `R2_PUBLIC_BASE_URL` is optional. If omitted, the app generates signed URLs through the S3-compatible API.

### Local development storage

```env
OBJECT_STORAGE_PROVIDER=local
OBJECT_STORAGE_BUCKET=local-dev
LOCAL_OBJECT_STORAGE_DIR=.local-object-storage
```

## Current app coverage

The storage abstraction is used by:

- document upload
- document signed URL generation
- document delete
- document download for AI review
- meeting-minute upload
- meeting-minute download for AI review
- corrected meeting-minute upload
- corrected meeting-minute download

## Current migration posture

Supabase storage compatibility has been removed from the runtime path. For environments that still have old Supabase env vars configured, the app now fails fast instead of silently using the wrong backend.

For development, the easiest path is:

1. Create a fresh R2 bucket.
2. Set `OBJECT_STORAGE_PROVIDER=cloudflare-r2`.
3. Fill in the R2 environment variables.
4. Restart `npm run dev`.
5. Re-upload development files as needed.

No database migration is required because existing rows already store a generic `storagePath`.

## Why this design

- Aligns runtime with the actual infrastructure choice: Neon + Cloudflare R2.
- Keeps DB schema stable.
- Makes future switches to other S3-compatible storage straightforward.
