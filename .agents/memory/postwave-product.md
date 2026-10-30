---
name: Postwave product identity
description: User-specified brand positioning and phased delivery scope.
---

Postwave is the user's multi-user social publishing product by Mazi Saint Concepts. Its tagline is "One post. Every platform."

The requested build order is Phase 1 (auth, accounts, compose, publish now, history), Phase 2 (scheduling, calendar, retries, drafts, previews), then Phase 3 (trials, billing, exchange rates, admin, pricing, and legal pages).

**Why:** the user explicitly specified the brand and phased delivery order.

**How to apply:** preserve the name, tagline, and footer in future Postwave work; keep Phase 2 and Phase 3 scope distinct from Phase 1.

Scheduled posts stay in Postwave's database until due; the separate worker scans and enqueues them for publishing instead of scheduling them directly with Zernio.

**Why:** keeping the schedule locally makes future trial-expiry pauses and subscription resumptions controllable without deleting scheduled content.

**How to apply:** when adding billing-based pause/resume behavior, update the local post state and queue promotion logic together; do not bypass this with provider-side scheduled posts.
