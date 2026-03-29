---
id: "04-API-Reference"
slug: "/04-API-Reference"
sidebar_position: 4
sidebar_label: "API Reference"
---

# 04 - API Reference

Complete reference for all Genesis Studio API endpoints. All routes are implemented as Next.js App Router route handlers under `src/app/api/`.

> **Related docs:** [03 — Directus CMS Integration](./03-Directus-CMS-Integration.md) | [05 — Authentication System](./05-Authentication-System.md) | [06 — Payment & Subscription System](./06-Payment-Subscription-System.md) | [13 — UI: Comments System](./13-UI-Comments-System.md)

---

## 1. Conventions

### Base URL

All endpoints are relative to the site domain:

```
https://genesistudio.com/api/*
```

### Authentication

Endpoints marked **Auth required** expect a Bearer token in the `Authorization` header:

```
Authorization: Bearer <supabase-access-token>
```

The token is obtained from the Supabase Auth session on the client side.

### Response Format

**Success responses** return raw data or a structured object:

```json
{ "success": true, "data": { ... } }
```

Or for list endpoints, a direct JSON array:

```json
[ { "id": "...", "novel_title": "..." }, ... ]
```

**Error responses** follow a consistent shape:

```json
{ "error": "Error message description" }
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized — missing or invalid auth token |
| 403 | Forbidden — insufficient permissions (e.g., chapter locked) |
| 404 | Not found |
| 409 | Conflict (e.g., duplicate operation) |
| 500 | Internal server error |
| 504 | Gateway timeout (Directus/upstream unavailable) |

### Cache Profiles

Applied via `Cache-Control` response headers. See [03 - Directus CMS Integration](./03-Directus-CMS-Integration.md#6-caching-strategy) for full details.

| Profile | Header Value | TTL |
|---------|-------------|-----|
| `static` | `public, s-maxage=3600, stale-while-revalidate=86400` | 1 hour |
| `dynamic` | `public, s-maxage=60, stale-while-revalidate=300` | 1 minute |
| `realtime` | `public, s-maxage=10, stale-while-revalidate=30` | 10 seconds |
| `user` | `private, no-cache, no-store, must-revalidate` | None |

---

## 2. Authentication Endpoints

### GET `/api/auth/confirm`

Handles email confirmation links from Supabase Auth (email verification, password recovery). Redirects the user to the frontend auth callback page.

| Param | Source | Description |
|-------|--------|-------------|
| `token_hash` | Query | Supabase auth token hash |
| `type` | Query | Auth type: `signup`, `recovery`, `email_change` |

**Response:** HTTP 302 redirect to `/auth/callback?token_hash=...&type=...`

For `type=recovery`, also appends `reset=true` query param.

**Auth required:** No

---

## 3. Directus CMS Proxy Endpoints

All Directus proxy routes import `serverDirectus` from `@/lib/directus-server` and use `@directus/sdk` query functions. The Directus token never reaches the client.

---

### GET `/api/directus/novels`

Returns all published novels from Directus.

**Auth required:** No

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `published` | Filter by status |
| `abbreviation` | string | — | Filter by URL slug |
| `serialization` | string | — | Filter by `ongoing`/`completed`/`hiatus` |
| `has_subscription` | boolean | — | Filter novels with subscriptions |
| `id` | string | — | Filter by novel UUID |
| `fields` | JSON string | `["*", "genres.genres_id"]` | Fields to return |
| `limit` | number | `-1` (all) | Max results |

**Response:** `Novel[]`

```json
[
  {
    "id": "uuid",
    "novel_title": "The Beginning After The End",
    "cover": "file-uuid",
    "banner": "file-uuid",
    "author": "TurtleMe",
    "status": "published",
    "abbreviation": "tbate",
    "one_liner": "I was king...",
    "synopsis": "Full synopsis text...",
    "genres": [{ "genres_id": 1 }],
    "chapter_numbers": 420,
    "rating": 4.8,
    "total_views": 1500000,
    "color_palette": ["#1a1a2e", "#16213e"],
    "serialization": "ongoing"
  }
]
```

**Cache:** dynamic | **Errors:** 500 on Directus failure

---

### GET `/api/directus/novels/by-abbreviation/[abv]`

Returns a single published novel by its URL slug with expanded genre data.

**Auth required:** No

**Path params:** `abv` — novel abbreviation (e.g., `tbate`)

**Response:** Single `Novel` object with nested genres:

```json
{
  "id": "uuid",
  "novel_title": "...",
  "genres": [
    { "genres_id": { "id": 1, "label": "Fantasy" } }
  ]
}
```

**Cache:** dynamic | **Errors:** 400 (missing abv), 404 (not found), 500

---

### GET `/api/directus/novels/by-id/[id]`

Returns a single novel by its UUID.

**Auth required:** No

**Path params:** `id` — novel UUID

**Response:** Single `Novel` object

**Cache:** dynamic | **Errors:** 400, 404, 500

---

### GET `/api/directus/chapters`

Returns chapters from Directus. Supports filter params.

**Auth required:** No

**Query parameters:** Supports standard Directus filter params via query string.

**Response:** `Chapter[]`

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/directus/genres`

Returns all genres.

**Auth required:** No

**Response:**

```json
[
  { "id": 1, "label": "Fantasy" },
  { "id": 2, "label": "Sci-Fi" }
]
```

**Cache:** static (s-maxage=3600) | **Errors:** 500

---

### GET `/api/directus/genre-sections`

Returns genre sections with nested novel data, sorted by `sort_order`.

**Auth required:** No

**Response:**

```json
[
  {
    "id": 1,
    "title": "Popular Fantasy",
    "sort_order": 1,
    "status": "published",
    "novels": [{ "novels_id": "uuid-or-object", "sort": 1 }]
  }
]
```

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/directus/release-days`

Returns the weekly release schedule with expanded novel data and day-of-week booleans.

**Auth required:** No

**Response:**

```json
[
  {
    "id": 1,
    "novel": { "id": "uuid", "novel_title": "...", "cover": "..." },
    "monday": true,
    "tuesday": false,
    "wednesday": true,
    "thursday": false,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "release_time": "10:00:00"
  }
]
```

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/directus/announcements`

Returns platform announcements sorted by `date_created` descending.

**Auth required:** No

**Response:**

```json
[
  {
    "id": 1,
    "title": "Platform Update v2.0",
    "content": "# Markdown content...",
    "date_created": "2025-01-15T12:00:00Z"
  }
]
```

**Cache:** realtime (s-maxage=10) | **Errors:** 500

---

### GET `/api/directus/showcases`

Returns published showcases for the homepage banner carousel.

**Auth required:** No

**Response:**

```json
[
  {
    "id": 1,
    "status": "published",
    "novels": "novel-uuid",
    "image": "file-uuid",
    "abbreviation": "tbate",
    "cta": "Read Now",
    "tags": ["Fantasy", "Action"],
    "color_palette": "{\"light\":{...},\"dark\":{...}}",
    "alt": "Banner description"
  }
]
```

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/directus/featured-novels`

Two-step fetch: retrieves `featured_novels` entries, then fetches full novel details for each entry using `Promise.allSettled` (so one bad entry won't fail the entire response).

**Auth required:** No

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `10` | Max featured novels |

**Response:** Enriched `Novel[]` (subset of fields):

```json
[
  {
    "id": "uuid",
    "novel_title": "...",
    "one_liner": "...",
    "synopsis": "...",
    "cover": "file-uuid",
    "showcase": "file-uuid",
    "abbreviation": "tbate",
    "color_palette": ["..."],
    "genres": [{ "genres_id": { "id": 1, "label": "Fantasy" } }]
  }
]
```

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/directus/trending-novels`

Returns ranked trending novels sorted by `rank` ascending.

**Auth required:** No

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `expand` | string | — | Set to `novel` to expand novel relations with genres |
| `fields` | JSON string | — | Custom fields override |

**Response (with `?expand=novel`):**

```json
[
  {
    "id": "uuid",
    "rank": 1,
    "novel": {
      "id": "uuid",
      "abbreviation": "tbate",
      "novel_title": "...",
      "cover": "file-uuid",
      "showcase": "file-uuid",
      "one_liner": "...",
      "color_palette": ["..."],
      "genres": [{ "genres_id": { "id": 1, "label": "Fantasy" } }]
    }
  }
]
```

**Cache:** `public, s-maxage=60, stale-while-revalidate=300` | **Errors:** 500

---

### GET `/api/directus/catalogue-spread`

Returns published catalogue sections with position sorting and flattened novel arrays.

**Auth required:** No

**Response:**

```json
[
  {
    "id": 1,
    "title": "Trending This Week",
    "subtitle": "Hottest reads",
    "position": 1,
    "novels": [
      {
        "id": "uuid",
        "novel_title": "...",
        "abbreviation": "...",
        "cover": "file-uuid",
        "showcase": "file-uuid"
      }
    ]
  }
]
```

The junction table (`catalogue_spread_novels`) is flattened so each section's `novels` array contains direct novel objects instead of junction records.

**Cache:** dynamic | **Errors:** Returns `[]` on failure (graceful degradation)

---

### GET `/api/directus/community-banner`

Returns the community banner configuration.

**Auth required:** No

**Response:**

```json
{
  "id": 1,
  "headline": "Join Our Community",
  "subheadline": "50,000+ readers and counting",
  "link_url": "https://discord.gg/genesistudio",
  "icon": "discord",
  "member_count": 50000,
  "enabled": true
}
```

**Cache:** static | **Errors:** 500

---

### GET `/api/directus/event-banners`

Returns active event banners.

**Auth required:** No

**Response:** `EventBanner[]`

```json
[
  {
    "id": 1,
    "title": "Summer Reading Event",
    "subtitle": "Earn double XP",
    "image": "file-uuid",
    "link_url": "/events/summer",
    "status": "published",
    "start_date": "2025-06-01T00:00:00Z",
    "end_date": "2025-08-31T23:59:59Z"
  }
]
```

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/directus/content/[type]`

Returns singleton content pages.

**Auth required:** No

**Path params:** `type` — one of: `about`, `privacy_policy`, `terms_of_service`

**Response:**

```json
{
  "id": "uuid",
  "content": "# About Genesis Studio\n\nMarkdown content here...",
  "date_created": "2025-01-01T00:00:00Z",
  "date_updated": "2025-06-15T12:00:00Z"
}
```

**Cache:** dynamic | **Errors:** 400 (invalid type), 500

---

### GET `/api/directus/contactus`

Returns contact information from the `contactus` singleton in Directus.

**Auth required:** No

**Response:**

```json
{
  "business_mail": "business@genesistudio.com",
  "business_body": "For business inquiries...",
  "support_mail": "support@genesistudio.com",
  "support_body": "For support requests...",
  "jobs_mail": "jobs@genesistudio.com",
  "jobs_body": "For job applications..."
}
```

**Cache:** static | **Errors:** 500

---

### GET `/api/directus/faq`

Returns all FAQ items sorted by category.

**Auth required:** No

**Response:**

```json
[
  {
    "id": 1,
    "category": "Account",
    "question": "How do I reset my password?",
    "answer": "You can reset your password from..."
  }
]
```

**Cache:** static | **Errors:** 500

---

### GET `/api/directus/user-profile/[id]`

Returns user profile data from Directus.

**Auth required:** Yes

**Path params:** `id` — Supabase user UUID

**Response:** `UserProfile` object

**Cache:** user (no-cache) | **Errors:** 401, 404, 500

---

### GET `/api/directus-file/[id]`

Returns file metadata from the Directus files API. Used internally to resolve file UUIDs to Supabase Storage filenames.

**Auth required:** No

**Path params:** `id` — Directus file UUID

**Response:**

```json
{
  "id": "file-uuid",
  "storage": "supabase",
  "filename_disk": "abc123-original-name.jpg",
  "filename_download": "cover-image.jpg",
  "title": "Novel Cover",
  "type": "image/jpeg",
  "filesize": "245000",
  "width": 800,
  "height": 1200,
  "uploaded_on": "2025-01-15T12:00:00Z"
}
```

**Cache:** `public, s-maxage=300, stale-while-revalidate=600` plus 5-minute in-memory server cache. Concurrency limited to 10 simultaneous requests to upstream Directus API.

**Errors:** 400 (missing ID), 500 (fetch failure), 504 (timeout after 15s)

---

## 4. Chapter Endpoints

### GET `/api/chapters/recent`

Returns recent chapters across all novels, categorized as paid or free.

**Auth required:** No

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `14` | Max results (capped at 50) |
| `type` | string | `paid` | `paid` or `free` |

A chapter is **paid** if its `chapter_number >= (max_chapter_number - 49)`, i.e., it's within the latest 50 chapters of its novel.

**Response:**

```json
[
  {
    "id": "uuid",
    "chapter_title": "Chapter 420: The Final Battle",
    "chapter_number": 420,
    "date_published": "2025-06-15T10:00:00Z",
    "status": "released",
    "novel": {
      "id": "uuid",
      "novel_title": "...",
      "cover": "file-uuid",
      "abbreviation": "tbate",
      "color_palette": ["..."],
      "has_subscription": true,
      "showcase": "file-uuid"
    },
    "isPaid": true,
    "helixCost": 100
  }
]
```

**Cache:** `public, s-maxage=120, stale-while-revalidate=300` | **Errors:** 500

---

### GET `/api/chapters/recently-freed`

Returns chapters that recently transitioned from paid to free (crossed the latest-50 threshold as newer chapters were published).

**Auth required:** No

**Response:** Similar structure to `/api/chapters/recent` with `isPaid: false`.

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/chapters/[id]/content`

**Secure chapter content delivery.** Returns full chapter text only to authorized users.

**Auth required:** Conditional (required for paid chapters)

**Path params:** `id` — chapter ID (integer)

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `user_id` | string | Supabase user UUID (for access control and read tracking) |

**Access control logic:**

1. Check if chapter exists and has `status: released`
2. Determine if paid (within latest 50 chapters of its novel)
3. **Free chapter:** Return content immediately; mark as read if user authenticated
4. **Paid chapter without auth:** Return 401 with `isPaid: true, helixCost: 100`
5. **Paid chapter with auth:** Check novel subscription OR individual chapter purchase
6. **Authorized:** Return watermarked content; mark as read; log access
7. **Unauthorized:** Return 403 with chapter metadata but `chapter_content: null`

**Response (authorized):**

```json
{
  "success": true,
  "data": {
    "id": 12345,
    "chapter_title": "Chapter 1: A New Beginning",
    "chapter_number": 1,
    "status": "released",
    "novel": "novel-uuid",
    "chapter_content": "<p>Chapter HTML content...</p>",
    "isPaid": true,
    "isUnlocked": true,
    "hasSubscription": false
  }
}
```

**Response (locked, 403):**

```json
{
  "error": "Chapter locked",
  "data": {
    "chapter_title": "...",
    "chapter_number": 1,
    "chapter_content": null,
    "isPaid": true,
    "isUnlocked": false,
    "helixCost": 100
  }
}
```

**Security:** Paid content is watermarked with invisible zero-width Unicode characters encoding the user ID, chapter ID, and timestamp. This enables leak tracking.

**Cache:** None (user-specific) | **Errors:** 400, 401, 403, 404, 500

---

### POST `/api/chapters/unlock`

Unlocks a paid chapter by deducting Helix from the user's wallet.

**Auth required:** Yes

**Request body:**

```json
{
  "chapter_id": "12345",
  "novel_id": "novel-uuid"
}
```

**Validation steps:**

1. Verify chapter is within the latest 50 (paid) chapters of the novel
2. Check user hasn't already purchased this chapter
3. **Sequential unlock enforcement:** User must have purchased all preceding paid chapters first
4. Verify sufficient Helix balance (100 Helix per chapter)
5. Deduct Helix and record purchase (with rollback on failure)

**Response (success):**

```json
{
  "success": true,
  "data": {
    "chapterId": "12345",
    "helixDeducted": 100,
    "newHelix": 900,
    "purchaseId": 1,
    "purchasedAt": "2025-06-15T12:00:00Z"
  }
}
```

**Errors:**

| Status | Error |
|--------|-------|
| 400 | "Chapter is not a paid chapter or does not exist" |
| 400 | "Chapter already unlocked" |
| 400 | "You must unlock chapters in sequence. Please unlock chapter(s) X, Y first." |
| 400 | "Insufficient Helix balance. You need 100 Helix to unlock this chapter." |
| 401 | "Authentication required" / "Invalid authentication token" |
| 404 | "No chapters found for this novel" |
| 500 | Server errors |

---

### GET `/api/novels-chapter/[id]`

Returns all chapters for a given novel ID. Includes access control information.

**Auth required:** No (but enhanced response with auth)

**Path params:** `id` — novel UUID

**Response:** Chapter list with paid/free status and user purchase info.

**Cache:** dynamic | **Errors:** 404, 500

---

### GET `/api/novels-chapter/recent`

Returns recent chapter updates across all novels.

**Auth required:** No

**Response:** Similar to `/api/chapters/recent`.

**Cache:** dynamic | **Errors:** 500

---

## 5. Payment Endpoints

### POST `/api/create-payment-intent`

Creates a generic Stripe PaymentIntent.

**Auth required:** No (caller provides metadata)

**Request body:**

```json
{
  "amount": 9.99,
  "currency": "usd",
  "metadata": {
    "type": "helix",
    "userId": "uuid",
    "helixAmount": "600"
  }
}
```

Note: `amount` is in dollars and is converted to cents internally.

**Response:**

```json
{
  "clientSecret": "pi_xxx_secret_xxx"
}
```

**Errors:** 500 (Stripe not configured or API failure)

---

### POST `/api/create-helix-payment-intent`

Creates a Stripe PaymentIntent specifically for Helix currency purchases.

**Auth required:** No (userId passed in body)

**Request body:**

```json
{
  "helixAmount": "600",
  "userId": "user-uuid"
}
```

**Valid Helix bundles:**

| Helix Amount | Price (USD) |
|-------------|------------|
| 600 | $9.99 |
| 1600 | $24.99 |
| 3500 | $49.99 |
| 5900 | $74.99 |
| 9300 | $99.99 |

**Response:**

```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "amount": 9.99
}
```

**Errors:** 400 (invalid bundle or missing userId), 500

---

### POST `/api/create-subscription`

Creates a Stripe subscription for a Luminary (platform-level) membership.

**Auth required:** No (customerId passed in body)

**Request body:**

```json
{
  "priceId": "price_xxx",
  "customerId": "cus_xxx"
}
```

**Response:**

```json
{
  "subscriptionId": "sub_xxx",
  "clientSecret": "pi_xxx_secret_xxx"
}
```

Uses `payment_behavior: 'default_incomplete'` so the subscription requires client-side payment confirmation.

**Errors:** 500

---

### POST `/api/create-novel-subscription`

Creates a Stripe PaymentIntent for a per-novel subscription ($29.99/month).

**Auth required:** Yes

**Request body:**

```json
{
  "novelId": "novel-uuid",
  "novelTitle": "The Beginning After The End"
}
```

**Validation:** Checks for existing active subscription for the same novel.

**Response:**

```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "subscriptionPrice": 29.99
}
```

**Errors:** 400 (missing novelId, already subscribed), 401, 500

---

### GET/POST `/api/novel-subscription`

Manages novel subscription status. GET retrieves active subscriptions; POST creates or updates.

**Auth required:** Yes

**Errors:** 401, 500

---

## 6. Webhook Endpoints

### POST `/api/webhooks/stripe`

Receives and processes Stripe webhook events. Uses service role Supabase client for database operations.

**Auth:** Stripe webhook signature verification (`stripe-signature` header + `STRIPE_WEBHOOK_SECRET`)

**Handled events:**

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` (type=helix) | Credits Helix to user's wallet, logs to `payment_logs` |
| `payment_intent.succeeded` (type=novel_subscription) | Creates `subscriptions` record (1-month duration), logs to `payment_logs` |
| `payment_intent.payment_failed` | Logs failure to `payment_logs` |
| `invoice.payment_succeeded` | Logs subscription renewal |

**Response:** `{ "received": true }` on success | **Errors:** 400 (invalid signature), 500

---

### POST `/api/webhooks/paypal`

Receives and processes PayPal webhook events.

**Auth:** PayPal webhook signature verification (headers: `paypal-transmission-id`, `paypal-transmission-sig`, etc.)

**Handled events:**

| Event | Action |
|-------|--------|
| `PAYMENT.CAPTURE.COMPLETED` | Credits Helix or creates subscription based on `custom_id` format |
| `PAYMENT.CAPTURE.DENIED` | Logs failure to `payment_logs` |
| `PAYMENT.CAPTURE.REFUNDED` | Creates refund log entry, links to original transaction |

PayPal payments use `custom_id` encoding: `userId|type|extraData` where `type` is `helix` or `novel_subscription`.

**Response:** `{ "received": true }` | **Errors:** 401 (invalid signature), 500

---

## 7. User Data Endpoints

### GET `/api/bookmark`

Returns all bookmarked novels for the authenticated user, enriched with Directus novel data.

**Auth required:** Yes

**Response:**

```json
[
  {
    "id": 1,
    "user_id": "uuid",
    "novel_id": "novel-uuid",
    "progress": 50,
    "save": "chapter-12",
    "date_created": "2025-01-15T12:00:00Z",
    "novel": {
      "id": "novel-uuid",
      "novel_title": "...",
      "cover": "file-uuid",
      "status": "published",
      "synopsis": "...",
      "abbreviation": "tbate"
    }
  }
]
```

Bookmarks with unpublished or deleted novels are filtered out.

**Cache:** user | **Errors:** 401, 500

---

### POST `/api/bookmark`

Toggles a bookmark on a novel. If the bookmark exists, it's removed; otherwise, it's created.

**Auth required:** Yes

**Request body:**

```json
{
  "novel_id": "novel-uuid",
  "progress": 50,
  "save": "chapter-12",
  "time_progress": 0,
  "time_save": 0
}
```

**Response (created):**

```json
{
  "id": 1,
  "user_id": "uuid",
  "novel_id": "novel-uuid",
  "novel": {
    "novel_title": "...",
    "cover": "file-uuid",
    "abbreviation": "tbate"
  }
}
```

**Response (removed):** `{ "removed": true }`

**Errors:** 401, 500

---

### GET `/api/bookmark/count`

Returns the total bookmark count for a novel.

**Auth required:** No

**Query parameters:** `novelId` — novel UUID

**Response:** `{ "count": 42 }`

**Errors:** 400, 500

---

### GET `/api/wallet/balance`

Returns the authenticated user's wallet balances. Creates a wallet if none exists (migrating from legacy `site_currencies` if present).

**Auth required:** Yes

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "helix": 600,
    "atom": 50
  }
}
```

**Cache:** user | **Errors:** 401, 500

---

### POST `/api/wallet/balance`

Adds Helix to the user's wallet (used internally after payment confirmation).

**Auth required:** Yes

**Request body:**

```json
{ "amount": 600 }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "helix": 1200,
    "amountAdded": 600
  }
}
```

**Errors:** 400 (invalid amount), 401, 500

---

### GET `/api/subscriptions`

Returns the authenticated user's active subscriptions.

**Auth required:** Yes

**Response:** Array of subscription objects with status and expiry info.

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/unlocked/chapters`

Returns all chapters the user has individually purchased.

**Auth required:** Yes

**Response:** Array of chapter purchase records.

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/unlocked/subscriptions`

Returns the user's active novel subscriptions.

**Auth required:** Yes

**Response:** Array of active subscription objects.

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/transactions`

Returns the user's payment transaction history with pagination.

**Auth required:** Yes

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `50` | Results per page |
| `offset` | number | `0` | Pagination offset |

**Response:**

```json
{
  "success": true,
  "transactions": [
    {
      "user_id": "uuid",
      "payment_provider": "stripe",
      "type": "helix",
      "amount_cents": 999,
      "currency": "usd",
      "status": "succeeded",
      "helix_amount": 600,
      "processed_at": "2025-06-15T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 15
  }
}
```

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/transactions/summary`

Returns an aggregated spending summary for the user. Uses the `get_user_total_spending` Supabase RPC function.

**Auth required:** Yes

**Response:**

```json
{
  "success": true,
  "summary": {
    "total_spent_cents": 4997,
    "total_spent_dollars": 49.97,
    "total_helix_purchased": 3500,
    "transaction_count": 3
  }
}
```

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/singularity`

Returns the user's current Singularity placement (a unique vote/endorsement a user can place on one novel).

**Auth required:** Yes

**Response:**

```json
{
  "novel_id": "novel-uuid",
  "can_move": true
}
```

If user has no singularity: `{ "novel_id": null, "can_move": true }`

**Errors:** 401, 500

---

### POST `/api/singularity`

Places or moves the user's Singularity to a novel. No cooldown — users can freely move their singularity.

**Auth required:** Yes

**Request body:**

```json
{
  "novel_id": "novel-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "novel_id": "novel-uuid",
  "can_move": true,
  "message": "Singularity placed successfully"
}
```

**Errors:** 400 (missing novel_id), 401, 500

---

### GET `/api/singularity/count`

Returns the total singularity count for a specific novel.

**Auth required:** No

**Query parameters:** `novelId` — novel UUID

**Response:** `{ "count": 150 }`

**Errors:** 400, 500

---

### GET `/api/singularity/rankings`

Returns novels ranked by singularity count, combining Supabase aggregation with Directus novel data.

**Auth required:** No

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `50` | Max results (1-100) |

**Response:**

```json
[
  {
    "novel_id": "uuid",
    "singularity_count": 250,
    "novel": {
      "id": "uuid",
      "novel_title": "...",
      "cover": "file-uuid",
      "showcase": "file-uuid",
      "abbreviation": "tbate",
      "one_liner": "...",
      "synopsis": "...",
      "color_palette": ["..."],
      "total_views": 1500000,
      "genres": [{ "genres_id": { "id": 1, "label": "Fantasy" } }]
    }
  }
]
```

**Implementation:** Fetches all singularities from Supabase, counts per novel in-memory, then batch-fetches published novel details from Directus for the top N results.

**Cache:** dynamic | **Errors:** 500

---

### GET `/api/profile/achievements`

Returns the user's achievements and progress.

**Auth required:** Yes

**Response:** Achievement objects with progress data.

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/profile`

Returns the authenticated user's profile from `user_profiles`.

**Auth required:** Yes

**Response:** `UserProfile` object with all profile fields.

**Cache:** user | **Errors:** 401, 500

---

### PUT `/api/profile`

Updates profile fields for the authenticated user.

**Auth required:** Yes

**Request body:** Accepts any combination of: `display_name`, `username`, `birthday`, `gender`, `profile_picture`.

Username validation: lowercase, alphanumeric + underscores only, uniqueness check (case-insensitive).

**Response:** Updated `UserProfile` object.

**Errors:** 400 (validation failure / username taken), 401, 500

---

### GET `/api/profile/check-username`

Checks username availability (case-insensitive).

**Auth required:** Yes

**Query parameters:** `username` — the username to check

**Response:**

```json
{ "available": true }
```

**Errors:** 400 (missing username), 401, 500

---

### GET `/api/profile/stats`

Returns the user's reading statistics and engagement summary.

**Auth required:** Yes

**Response:**

```json
{
  "chaptersRead": 142,
  "favoritedNovels": 8,
  "comments": 37,
  "streak": 12,
  "level": 5,
  "isLuminary": true
}
```

| Field | Description |
|-------|-------------|
| `chaptersRead` | Total chapters read |
| `favoritedNovels` | Number of bookmarked novels |
| `comments` | Total comments posted |
| `streak` | Consecutive reading days |
| `level` | Derived from lifetime shards |
| `isLuminary` | Whether user has an active subscription |

**Cache:** user | **Errors:** 401, 500

---

### POST `/api/billing/portal/stripe`

Creates a Stripe Customer Portal session for subscription and payment management.

**Auth required:** Yes

**Response:**

```json
{ "url": "https://billing.stripe.com/p/session/..." }
```

The returned URL is used for client-side redirect to the Stripe-hosted portal.

**Errors:** 401, 500

---

### GET `/api/billing/subscriptions/paypal`

Lists the user's PayPal subscriptions with associated novel titles and management URLs.

**Auth required:** Yes

**Response:** Array of PayPal subscription objects with novel details and PayPal management links.

**Cache:** user | **Errors:** 401, 500

---

### GET `/api/auth/devices`

Lists active sessions for the authenticated user via the `get_user_sessions` RPC function. Parses `user_agent` strings into structured browser, OS, and device information. Flags the current session.

**Auth required:** Yes

**Response:** Array of session objects with parsed device info and `isCurrent` flag.

**Cache:** user | **Errors:** 401, 500

---

### DELETE `/api/auth/devices`

Revokes a specific auth session via the `delete_user_session` RPC function.

**Auth required:** Yes

**Request body:**

```json
{ "sessionId": "session-uuid" }
```

**Response:** `{ "success": true }`

**Errors:** 400 (missing sessionId), 401, 500

---

## 8. Comment Endpoints

### GET `/api/comments`

Fetches comments for a specific chapter, with user profiles, vote status, and nested replies.

**Auth required:** No (auth optional — used for vote status)

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `chapterId` | number | **required** | Chapter to fetch comments for |
| `sort` | string | `top` | Sort order: `top`, `new`, `old` |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 50) |

**Response:**

```json
{
  "comments": [
    {
      "id": "uuid",
      "content": "Great chapter!",
      "processed_content": "Great chapter!",
      "upvotes": 15,
      "downvotes": 2,
      "created_at": "2025-06-15T12:00:00Z",
      "user_id": "uuid",
      "chapter_id": 12345,
      "parent_comment": null,
      "user_profile": {
        "user_id": "uuid",
        "username": "Reader42",
        "profile_picture": "url",
        "is_staff": false,
        "supporter": true
      },
      "user_vote": "up",
      "replies": [],
      "reply_count": 3
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "has_more": true
}
```

Includes first 3 replies per top-level comment. User profiles are batch-fetched from Directus.

**Cache:** realtime | **Errors:** 400 (missing chapterId), 500

---

### POST `/api/comments`

Creates a new comment on a chapter.

**Auth required:** Yes

**Request body:**

```json
{
  "chapterId": 12345,
  "content": "Great chapter!",
  "parentComment": "parent-uuid-or-null"
}
```

**Validation:** Content is required, trimmed, max 2000 characters.

**Response (201):**

```json
{
  "id": "uuid",
  "content": "Great chapter!",
  "upvotes": 0,
  "downvotes": 0,
  "user_profile": { ... },
  "user_vote": null,
  "replies": [],
  "reply_count": 0
}
```

**Errors:** 400 (validation), 401, 500

---

### PATCH `/api/comments/[commentId]`

Edits an existing comment.

**Auth required:** Yes (must be comment owner)

**Path params:** `commentId` — comment UUID

**Request body:**

```json
{
  "content": "Updated comment text"
}
```

**Validation:** Content is required, trimmed, max 2000 characters.

**Response:** Updated comment object with `edited_at` set.

**Errors:** 400 (validation), 401, 403 (not owner), 404, 500

---

### POST `/api/comments/[commentId]/vote`

Upvotes or downvotes a comment.

**Auth required:** Yes

**Path params:** `commentId` — comment UUID

**Request body:**

```json
{
  "type": "up"
}
```

The endpoint supports three actions depending on the current vote state:

- add a new vote
- remove the same vote if clicked again
- switch from `up` to `down` or vice versa

**Errors:** 400, 401, 500

---

### GET `/api/comments/[commentId]/replies`

Fetches paginated replies for a parent comment.

**Auth required:** No (auth optional — used for `user_vote` state)

**Path params:** `commentId` — parent comment UUID

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Results per page (max 50) |

**Response:**

```json
{
  "replies": [
    {
      "id": "uuid",
      "parent_comment": "parent-uuid",
      "content": "Reply text",
      "user_profile": { "username": "Reader42" },
      "user_vote": null
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 10,
  "has_more": true
}
```

Replies are returned in chronological order and enriched with Directus user profile data.

**Cache:** realtime | **Errors:** 404, 500

---

### DELETE `/api/comments/[commentId]`

Soft-deletes a comment (sets `deleted_by_user` flag).

**Auth required:** Yes (must be comment author)

**Errors:** 401, 403, 404, 500

---

### POST `/api/comments/[commentId]/report`

Reports a comment for moderation.

**Auth required:** Yes

**Request body:**

```json
{
  "reason": "spoiler",
  "comment": "Contains end-of-arc spoilers without warning"
}
```

**Validation / business rules:**

- comment must exist
- reporter must be authenticated
- self-reporting is rejected
- duplicate reports for the same comment/user pair are rejected

**Errors:** 400, 401, 404, 409, 500

---

## 9. Utility Endpoints

### POST `/api/extract-colors`

Extracts a color palette from an image URL using `node-vibrant` and stores the result in Directus.

**Auth required:** No

**Request body:**

```json
{
  "novelId": "novel-uuid",
  "coverUrl": "https://storage.example.com/image.jpg"
}
```

Or for showcases:

```json
{
  "showcaseId": 1,
  "coverUrl": "https://storage.example.com/banner.jpg"
}
```

**Response:**

```json
{
  "palette": {
    "light": {
      "primary": "#22D3EE",
      "secondary": "#67E8F9",
      "background": "#a5f3fc",
      "text": "#0e7490",
      "accent": "#0891B2"
    },
    "dark": {
      "primary": "#0e7490",
      "secondary": "#164e63",
      "background": "#164e63",
      "text": "#67E8F9",
      "accent": "#22D3EE"
    }
  }
}
```

Automatically updates the `color_palette` field in the corresponding Directus collection (`novels` or `showcases`).

**Errors:** 400 (missing params), 500 (extraction failure, 15s timeout)

---

### POST `/api/test/add-helix`

**Development only.** Adds Helix to a user's wallet for testing purposes.

**Auth required:** Implementation-dependent

**Request body:** `{ "userId": "uuid", "amount": 1000 }`

**Response:** Updated wallet balance

**Note:** This endpoint should be disabled or removed in production.

---

## 10. Error Response Format

All error responses follow a consistent JSON format:

```json
{
  "error": "Human-readable error message"
}
```

Some endpoints include additional context:

```json
{
  "error": "Chapter locked",
  "data": {
    "isPaid": true,
    "isUnlocked": false,
    "helixCost": 100
  }
}
```

Or with success flag:

```json
{
  "success": false,
  "error": "Failed to fetch transactions"
}
```

Error responses always include `Cache-Control: no-cache, no-store, must-revalidate` headers regardless of the endpoint's normal cache profile.

---

## 11. Endpoint Summary Table

| # | Method | Route | Auth | Cache |
|---|--------|-------|------|-------|
| 1 | GET | `/api/auth/confirm` | No | — (redirect) |
| 2 | GET | `/api/directus/novels` | No | dynamic |
| 3 | GET | `/api/directus/novels/by-abbreviation/[abv]` | No | dynamic |
| 4 | GET | `/api/directus/novels/by-id/[id]` | No | dynamic |
| 5 | GET | `/api/directus/chapters` | No | dynamic |
| 6 | GET | `/api/directus/genres` | No | static |
| 7 | GET | `/api/directus/genre-sections` | No | dynamic |
| 8 | GET | `/api/directus/release-days` | No | dynamic |
| 9 | GET | `/api/directus/announcements` | No | realtime |
| 10 | GET | `/api/directus/showcases` | No | dynamic |
| 11 | GET | `/api/directus/featured-novels` | No | dynamic |
| 12 | GET | `/api/directus/trending-novels` | No | dynamic |
| 13 | GET | `/api/directus/catalogue-spread` | No | dynamic |
| 14 | GET | `/api/directus/community-banner` | No | static |
| 15 | GET | `/api/directus/event-banners` | No | dynamic |
| 16 | GET | `/api/directus/content/[type]` | No | dynamic |
| 17 | GET | `/api/directus/contactus` | No | static |
| 18 | GET | `/api/directus/faq` | No | static |
| 19 | GET | `/api/directus/user-profile/[id]` | Yes | user |
| 20 | GET | `/api/directus-file/[id]` | No | 5min |
| 21 | GET | `/api/chapters/recent` | No | dynamic |
| 22 | GET | `/api/chapters/recently-freed` | No | dynamic |
| 23 | GET | `/api/chapters/[id]/content` | Conditional | user |
| 24 | POST | `/api/chapters/unlock` | Yes | — |
| 25 | GET | `/api/novels-chapter/[id]` | No | dynamic |
| 26 | GET | `/api/novels-chapter/recent` | No | dynamic |
| 27 | POST | `/api/create-payment-intent` | No | — |
| 28 | POST | `/api/create-helix-payment-intent` | No | — |
| 29 | POST | `/api/create-subscription` | No | — |
| 30 | POST | `/api/create-novel-subscription` | Yes | — |
| 31 | GET/POST | `/api/novel-subscription` | Yes | — |
| 32 | POST | `/api/webhooks/stripe` | Stripe sig | — |
| 33 | POST | `/api/webhooks/paypal` | PayPal sig | — |
| 34 | GET | `/api/bookmark` | Yes | user |
| 35 | POST | `/api/bookmark` | Yes | — |
| 36 | GET | `/api/bookmark/count` | No | dynamic |
| 37 | GET | `/api/wallet/balance` | Yes | user |
| 38 | POST | `/api/wallet/balance` | Yes | — |
| 39 | GET | `/api/subscriptions` | Yes | user |
| 40 | GET | `/api/unlocked/chapters` | Yes | user |
| 41 | GET | `/api/unlocked/subscriptions` | Yes | user |
| 42 | GET | `/api/transactions` | Yes | user |
| 43 | GET | `/api/transactions/summary` | Yes | user |
| 44 | GET | `/api/singularity` | Yes | user |
| 45 | POST | `/api/singularity` | Yes | — |
| 46 | GET | `/api/singularity/count` | No | dynamic |
| 47 | GET | `/api/singularity/rankings` | No | dynamic |
| 48 | GET | `/api/profile` | Yes | user |
| 49 | PUT | `/api/profile` | Yes | — |
| 50 | GET | `/api/profile/check-username` | Yes | — |
| 51 | GET | `/api/profile/achievements` | Yes | user |
| 52 | GET | `/api/profile/stats` | Yes | user |
| 53 | POST | `/api/billing/portal/stripe` | Yes | — |
| 54 | GET | `/api/billing/subscriptions/paypal` | Yes | user |
| 55 | GET | `/api/auth/devices` | Yes | user |
| 56 | DELETE | `/api/auth/devices` | Yes | — |
| 57 | GET | `/api/comments` | No | realtime |
| 58 | POST | `/api/comments` | Yes | — |
| 59 | PATCH | `/api/comments/[commentId]` | Yes | — |
| 60 | POST | `/api/comments/[commentId]/vote` | Yes | — |
| 61 | GET | `/api/comments/[commentId]/replies` | No | realtime |
| 62 | DELETE | `/api/comments/[commentId]` | Yes | — |
| 63 | POST | `/api/comments/[commentId]/report` | Yes | — |
| 64 | POST | `/api/extract-colors` | No | — |
| 65 | POST | `/api/test/add-helix` | Dev | — |
