# Postwave Phase 1 product contract

Postwave by Mazi Saint Concepts helps creators publish one post to their own social accounts across platforms. Phase 1 includes account access, per-user Late/Zernio profiles, OAuth connections, media-backed composition, immediate publishing, and per-platform history.

## Pages

- `/login` — sign in to an existing account.
- `/signup` — create an account and request email verification.
- `/verify-email` — confirm the token from the verification email.
- `/forgot-password` — request a reset email without disclosing account existence.
- `/reset-password` — set a new password from a reset token.
- `/dashboard` — publishing overview and recent posts.
- `/accounts` — connect, inspect, and disconnect the signed-in user's accounts.
- `/compose` — write a post, attach media, select accounts, preview platforms, and publish now.
- `/history` — list posts with the status and error for each platform, with retry for failed targets.

## API contract

All app API routes are same-origin under `/api`. Authentication is cookie-based; APIs derive the user ID from the session and never accept a user ID from the browser.

- `GET /api/auth/me` → `{ user: { id, email, name } | null }`
- `POST /api/auth/signup` `{ email, password, name }` → `{ message }`
- `POST /api/auth/login` `{ email, password }` → `{ user }`
- `POST /api/auth/logout` → `{ ok }`
- `POST /api/auth/verify-email` `{ token }` → `{ ok }`
- `POST /api/auth/forgot-password` `{ email }` → `{ message }`
- `POST /api/auth/reset-password` `{ token, password }` → `{ ok }`
- `GET /api/accounts` → `{ accounts: Account[] }`
- `POST /api/accounts/connect` `{ platform }` → `{ authUrl }`
- `DELETE /api/accounts/:id` → `{ ok }`
- `POST /api/media/upload-url` `{ name, contentType, size }` → `{ uploadUrl, key, publicUrl, headers }`
- `POST /api/media/complete` `{ key }` → `{ media: MediaAsset }`
- `POST /api/posts` `{ content, accountIds, mediaAssetIds }` → `{ post }`
- `GET /api/posts` → `{ posts: Post[] }`
- `GET /api/posts/:id` → `{ post }`
- `POST /api/posts/:id/retry` `{ accountId }` → `{ post }`
- `GET /api/health` → `{ status: "ok" }`
- `POST /api/webhooks/late` → provider webhook receiver; signature-verified before applying status changes.

`Account` includes `id`, `platform`, `username`, `displayName`, and `isActive`.
`MediaAsset` includes `id`, `key`, `publicUrl`, `contentType`, and `size`.
`Post` includes `id`, `content`, `status`, `createdAt`, and `platforms[]`; each platform entry includes `platform`, `accountId`, `status`, `errorMessage`, and `platformPostUrl`.

## Platform values

Use Late/Zernio API values: `facebook`, `instagram`, `threads`, `linkedin`, `twitter`, `tiktok`, `youtube`, `pinterest`, `reddit`, `bluesky`, `googlebusiness`, `telegram`, `discord`, `slack`, and `whatsapp`.

## Product invariants

- Every account, post, and media record is scoped to the authenticated user on the server.
- Every Postwave user maps to one Late/Zernio profile with the Postwave user ID as `externalId`.
- OAuth return state is one-time and bound to the initiating user and provider profile.
- Provider API keys, password reset/verification tokens, and session IDs are never logged or returned to the browser.
- Image and video uploads use S3-compatible object storage; media bytes never live in PostgreSQL or on the app server's local disk.
- A provider publishing error remains visible as a per-platform failed status and can be retried safely.
