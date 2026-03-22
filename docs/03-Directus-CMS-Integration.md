---
id: "03-Directus-CMS-Integration"
slug: "/03-Directus-CMS-Integration"
sidebar_position: 3
sidebar_label: "Directus CMS Integration"
---

# 03 - Directus CMS Integration

Genesis Studio uses [Directus](https://directus.io/) as its headless CMS for managing all editorial content — novels, chapters, banners, announcements, and more. The Directus admin interface is hosted at **edit.genesistudio.com** and is used by content editors and staff to manage the platform's content library.

> **Related docs:** [01 — Architecture Overview](./01-Architecture-Overview.md) | [04 — API Reference](./04-API-Reference.md) | [07 — Image Pipeline](./07-Image-Pipeline.md)

---

## 1. Architecture

All CMS content follows a strict server-side-only data flow:

```
Directus Admin UI (edit.genesistudio.com)
        │
        ▼
  Directus REST API
        │
        ▼
  Next.js API Proxy (/api/directus/*)     ◄── DIRECTUS_TOKEN (server-side only)
        │
        ▼
  Frontend (React client components)      ◄── NO Directus token, NO SDK client
```

**Key security principle:** The `DIRECTUS_TOKEN` is **never** exposed to the client. All browser-initiated requests go through the `/api/directus/*` proxy routes, which authenticate with Directus on the server side and return sanitized JSON.

---

## 2. Connection & Configuration

### 2.1 Server-Side Client — `src/lib/directus-server.ts`

The server-side Directus client is the **only** module that holds the authentication token. It uses `@directus/sdk` 20.1.0.

```typescript
import { createDirectus, staticToken, rest } from '@directus/sdk';
import type { Schema } from './directus';

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_API!;
const directusToken = process.env.DIRECTUS_TOKEN;

const serverDirectus = createDirectus<Schema>(directusUrl)
  .with(staticToken(directusToken || ''))
  .with(rest());

export default serverDirectus;
```

**Guard:** The module calls `ensureServerSide()` on import, which throws an error if `typeof window !== 'undefined'`. This prevents accidental import in client components.

**Environment variables:**

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_DIRECTUS_API` | Public (URL only) | Directus instance URL |
| `DIRECTUS_TOKEN` | Server-only | Static API token for authenticated requests |

### 2.2 Client-Side Utilities — `src/lib/directus.ts`

This module exports **no Directus SDK client**. It provides:

- `Schema` interface — TypeScript type mapping of all Directus collections
- CMS type definitions — `Novel`, `Chapter`, `Genre`, `Showcase`, `UserProfile`, etc.
- `DirectusFileMetadata` interface — shape of file metadata from the `/api/directus-file/[id]` route
- Image/asset utility functions:

| Function | Purpose |
|----------|---------|
| `getAssetUrl(assetId, useTransform?, variant?, baseUrl?)` | Async — fetches file metadata, constructs Supabase Storage URL |
| `getAssetUrlSync(assetId)` | Sync — returns cached Supabase URL or empty string |
| `prefetchFileMetadata(assetIds[])` | Batch prefetch metadata for multiple assets |
| `getTransformedImageUrl(imageUrl, variant?)` | Apply Cloudflare Image Transformations |
| `transformSupabaseImageUrl(supabaseUrl, variant?)` | Apply transforms to direct Supabase URLs |
| `IMAGE_VARIANTS` | Predefined Cloudflare transform presets (thumbnail, cover, banner, hero, square, full) |

### 2.3 Exception: OG Image Generation

The file `src/app/novels/[abv]/opengraph-image.tsx` creates a standalone Directus client **without** authentication for server-side OG image rendering. This is acceptable because it runs exclusively on the server during image generation.

---

## 3. Schema Interface

The `Schema` type in `src/lib/directus.ts` maps Directus collections to their TypeScript types:

```typescript
export interface Schema {
  novels: Novel[];
  chapters: Chapter[];
  genres: Genre[];
  release_days: ReleaseDay[];
  genre_sections: GenreSection[];
  event_banners: EventBanner[];
  community_banner: CommunityBanner[];
  catalogue_spread: CatalogueSpread[];
  catalogue_spread_novels: CatalogueSpreadNovel[];
  announcements: Announcement[];
  trending_novels: TrendingNovel[];
  featured_novels: FeaturedNovel[];
  showcase: Showcase[];
  showcases: Showcase[];
  banners: Banner[];
  user_profiles: UserProfile[];
  privacy_policy: PrivacyPolicy[];
  terms_of_service: TermsOfService[];
  about: About[];
}
```

Each interface corresponds to a Directus collection and defines the fields available for querying via the SDK.

---

## 4. Directus Collections

### 4.1 `novels` — Main Content

The primary content collection. Each record represents a web novel on the platform.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Primary key |
| `novel_title` | `string` | Display title |
| `cover` | `string` (file UUID) | Cover image (portrait) |
| `banner` | `string` (file UUID) | Wide banner image |
| `showcase` | `string` (file UUID) | Hero/showcase image |
| `square` | `string` (file UUID) | Square thumbnail |
| `author` | `string` | Author name |
| `status` | `string` | `published` / `draft` / `archived` |
| `abbreviation` | `string` | URL slug (e.g., `tbate`) |
| `one_liner` | `string` | Short tagline |
| `synopsis` | `string` | Full description (supports markdown) |
| `genres` | M2M → `genres` | Through `novels_genres` junction |
| `tags` | M2M → `tags` | Through `novels_tags` junction |
| `chapter_numbers` | `number` | Total chapter count |
| `rating` | `number` \| `null` | Average rating |
| `serialization` | `string` | Status: `ongoing`, `completed`, `hiatus` |
| `color_palette` | `string[]` | Extracted color theme (JSON) |
| `total_views` | `number` | Aggregated view count |
| `page_views` | `number` | Recent page view count |
| `latest_free_chapter` | `number` | Highest free chapter number |
| `available_tiers` | `number` | Number of subscription tiers |
| `original` | `string` | Original source reference |
| `date_created` | `timestamp` | Creation date |
| `date_updated` | `timestamp` | Last update |

**Display template:** `{{novel_title}}`

**Frontend usage:** Novel detail pages (`/novels/[abv]`), catalogue grids, search results, trending/featured sections.

---

### 4.2 `chapters` — Chapter Content

Individual chapter entries linked to novels.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `chapter_title` | `string` | Chapter title |
| `chapter_number` | `number` | Sequential chapter number |
| `chapter_content` | `text` | Full chapter text (HTML/markdown) |
| `novel` | M2O → `novels` | Parent novel reference |
| `status` | `string` | `released` / `draft` |
| `date_published` | `timestamp` | Publication date |
| `date_created` | `timestamp` | Creation date |
| `date_updated` | `timestamp` | Last modification |

**Preview URL:** `genesistudio.com/viewer/{{id}}`

**Frontend usage:** Chapter reader (`/viewer/[id]`), recent releases, chapter lists on novel pages. The latest 50 chapters of any novel are considered "paid" and require Helix or an active subscription to access.

---

### 4.3 `genres` — Genre Labels

Simple label collection for categorizing novels.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Primary key |
| `label` | `string` | Genre name (e.g., "Fantasy", "Sci-Fi") |

**Relations:** M2M with `novels` through `novels_genres` junction.

**Frontend usage:** Genre filter chips, novel detail metadata, search filters.

---

### 4.4 `tags` — Tag Labels

Simple label collection for fine-grained tagging.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Primary key |
| `label` | `string` | Tag name |

**Relations:** M2M with `novels` through `novels_tags` junction.

**Frontend usage:** Novel detail tags, search refinement.

---

### 4.5 `showcases` — Hero Banner Slides

Controls the hero banner carousel on the homepage.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Primary key |
| `status` | `string` | `published` / `draft` |
| `novels` | `string` (FK → novels) | Linked novel |
| `image` | `string` (file UUID) | Banner image |
| `abbreviation` | `string` \| `null` | Novel abbreviation for linking |
| `cta` | `string` \| `null` | Call-to-action text |
| `tags` | `string[]` (JSON) | Tag labels for display |
| `color_palette` | `string` \| `null` | Color theme string |
| `alt` | `string` \| `null` | Image alt text |

**Frontend usage:** `BannerCarousel` component on the homepage. Only `published` showcases are displayed, sorted by creation date.

---

### 4.6 `featured_novels` — Curated Featured List

Editor-curated list of novels to feature on the homepage.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `novel` | `string` (FK → novels) | Featured novel reference |
| `date_created` | `timestamp` | When added |

**Frontend usage:** Featured section on the homepage. The API route performs a two-step fetch: first gets `featured_novels` entries, then fetches full novel details (title, cover, genres, synopsis, etc.) for each entry using `Promise.allSettled` for resilience.

---

### 4.7 `trending_novels` — Ranked Trending List

Ranked list of currently trending novels, ordered by a manual `rank` field.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `rank` | `number` | Display rank (1 = top) |
| `novel` | `string` \| Novel (FK → novels) | Trending novel reference |

**Frontend usage:** `TrendingSection` on homepage. Supports `?expand=novel` query param to inline full novel data including genres. Sorted by `rank` ascending.

---

### 4.8 `catalogue_spread` — Dynamic Category Sections

Position-ordered content sections for the homepage/browse page. Each section contains a curated list of novels.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Primary key |
| `title` | `string` | Section heading |
| `subtitle` | `string` \| `null` | Optional subheading |
| `position` | `number` | Display sort order |
| `status` | `string` | `published` / `draft` |

**Junction:** `catalogue_spread_novels` links `catalogue_spread` to `novels` via `catalogue_spread_id` and `novels_id`.

**Frontend usage:** Horizontal scroll rows on the browse page. The API flattens the junction table so each section returns a `novels[]` array directly.

---

### 4.9 `genre_sections` — Genre-Based Groupings

Groups of novels organized by genre or theme, with sort control.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` \| `string` | Primary key |
| `title` | `string` | Section title |
| `sort_order` | `number` | Display order |
| `status` | `string` | `published` / `draft` |
| `novels` | M2M with sort | Novel list with ordering |

**Frontend usage:** Genre-organized browsing sections. Each entry contains a sorted array of `{ novels_id, sort }` objects.

---

### 4.10 `release_days` — Weekly Schedule

Defines which days of the week each novel publishes new chapters.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` \| `string` | Primary key |
| `novel` | FK → `novels` | Novel reference |
| `monday` through `sunday` | `boolean` | Release day flags |
| `release_time` | `string` \| `null` | Time of day for releases |

**Frontend usage:** `RecentsTab` schedule view, showing which novels release on which days.

---

### 4.11 `event_banners` — Promotional Banners

Time-bounded promotional banners for events or campaigns.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` \| `string` | Primary key |
| `title` | `string` | Banner title |
| `subtitle` | `string` \| `null` | Supporting text |
| `image` | `string` \| `null` (file UUID) | Banner image |
| `link_url` | `string` \| `null` | Click destination |
| `status` | `string` | `published` / `draft` |
| `start_date` | `timestamp` \| `null` | Campaign start |
| `end_date` | `timestamp` \| `null` | Campaign end |

**Frontend usage:** Event banner components. Filtered by date range and status on the API side.

---

### 4.12 `community_banner` — Community CTA

Single community call-to-action banner (typically linking to Discord or social community).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` \| `string` | Primary key |
| `headline` | `string` | Main heading |
| `subheadline` | `string` | Supporting text |
| `link_url` | `string` | Destination URL |
| `icon` | `string` \| `null` | Icon identifier |
| `member_count` | `number` \| `null` | Current member count |
| `enabled` | `boolean` | Toggle visibility |

**Frontend usage:** Community section on homepage/sidebar. Cached with `static` profile (1 hour).

---

### 4.13 `announcements` — Platform News

Platform-wide announcements and news posts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` \| `string` | Primary key |
| `title` | `string` | Announcement title |
| `content` | `text` | Body content (markdown) |
| `date_created` | `timestamp` | Publication date |
| `date_updated` | `timestamp` | Last edit |

**Frontend usage:** `/announcements` page. Sorted by `date_created` descending. Cached with `realtime` profile (10-second revalidation).

---

### 4.14 `user_profiles` — User Data

User profile data synced from Supabase Auth. Managed by the application, not typically edited in Directus admin.

This collection is also used by the comments subsystem: comment rows live in Supabase, but author display data (`username`, `profile_picture`, `is_staff`, `supporter`) is enriched from Directus `user_profiles` inside the comments API routes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Supabase user ID |
| `profile_picture` | `string` | Profile image URL |
| `username` | `string` | Display name |
| `bio` | `string` | User biography |
| `chapter_releases` | `boolean` | Notification pref |
| `replies` | `boolean` | Notification pref |
| `mentions` | `boolean` | Notification pref |
| `joined_at` | `timestamp` | Registration date |
| `supporter` | `boolean` | Supporter badge flag |
| `newcomer` | `boolean` | Newcomer badge flag |
| `is_staff` | `boolean` | Staff badge flag |
| `provider` | `string` | Auth provider |
| `profile_id` | `number` \| `string` | Directus profile ID |
| `customer_id` | `string` \| `null` | Stripe customer ID |
| `atoms` | `number` | Atom currency balance |

**Frontend usage:** Comment author info, profile pages, user badges. Cached with `user` profile (no-cache).

---

### 4.15 `banners` — Legacy Banner Collection

Legacy banner collection from an earlier version of the site.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Primary key |
| `status` | `string` | Published status |
| `novels` | `string` | Novel reference |
| `image` | `string` (file UUID) | Banner image |
| `alt` | `string` \| `null` | Alt text |
| `slug` | `string` | URL slug |

**Note:** Superseded by `showcases` for homepage banners. Retained for backward compatibility.

---

### 4.16 Singleton Collections

These collections contain a single record each, used for site-wide content pages.

| Collection | Field | Type | Used For |
|------------|-------|------|----------|
| `about` | `content` | `text` (markdown) | /about page |
| `privacy_policy` | `content` | `text` (markdown) | /privacy-policy page |
| `terms_of_service` | `content` | `text` (markdown) | /terms-of-service page |

**API route:** `GET /api/directus/content/[type]` where `type` is `about`, `privacy_policy`, or `terms_of_service`.

---

## 5. API Proxy Routes

All Directus data passes through Next.js API routes. Each route imports `serverDirectus` and uses `readItems`/`readItem` from `@directus/sdk` to query data, then returns JSON.

| Route | Method | Directus Collection(s) | Cache Profile |
|-------|--------|----------------------|---------------|
| `/api/directus/novels` | GET | `novels` | dynamic (s-maxage=60) |
| `/api/directus/novels/by-abbreviation/[abv]` | GET | `novels` | dynamic |
| `/api/directus/novels/by-id/[id]` | GET | `novels` | dynamic |
| `/api/directus/chapters` | GET | `chapters` | dynamic |
| `/api/directus/genres` | GET | `genres` | static (s-maxage=3600) |
| `/api/directus/genre-sections` | GET | `genre_sections` | dynamic |
| `/api/directus/release-days` | GET | `release_days` | dynamic |
| `/api/directus/announcements` | GET | `announcements` | realtime (s-maxage=10) |
| `/api/directus/showcases` | GET | `showcases` | dynamic |
| `/api/directus/featured-novels` | GET | `featured_novels` + `novels` | dynamic |
| `/api/directus/trending-novels` | GET | `trending_novels` | dynamic (s-maxage=60, swr=300) |
| `/api/directus/catalogue-spread` | GET | `catalogue_spread` + junction | dynamic |
| `/api/directus/community-banner` | GET | `community_banner` | static |
| `/api/directus/event-banners` | GET | `event_banners` | dynamic |
| `/api/directus/content/[type]` | GET | `about` / `privacy_policy` / `terms_of_service` | dynamic |
| `/api/directus/user-profile/[id]` | GET | `user_profiles` | user (no-cache) |
| `/api/directus-file/[id]` | GET | Directus `/files/` API | s-maxage=300, swr=600 |

All routes follow the same pattern:

1. Import `serverDirectus` from `@/lib/directus-server`
2. Use `readItems()` or `readItem()` with typed collection name
3. Apply filters (typically `status: { _eq: 'published' }`)
4. Return `NextResponse.json(data)` with appropriate cache headers

See [04 - API Reference](./04-API-Reference.md) for detailed request/response documentation of each route.

---

## 6. Caching Strategy

Four cache profiles are defined in `src/lib/api-utils.ts` and applied via the `jsonWithCache()` helper:

| Profile | Cache-Control Header | Use Case |
|---------|---------------------|----------|
| **static** | `public, s-maxage=3600, stale-while-revalidate=86400` | Rarely-changing data: genres, tags, community banner |
| **dynamic** | `public, s-maxage=60, stale-while-revalidate=300` | Periodically-changing data: novels, chapters, trending, showcases |
| **realtime** | `public, s-maxage=10, stale-while-revalidate=30` | Frequently-changing data: announcements, comments |
| **user** | `private, no-cache, no-store, must-revalidate` | User-specific data: wallet, bookmarks, profiles |

**Usage in API routes:**

```typescript
import { jsonWithCache } from '@/lib/api-utils';

// In a route handler:
return jsonWithCache(novelsData, 'dynamic');
return jsonWithCache(genres, 'static');
return jsonWithCache(walletData, 'user');
```

Error responses always use `no-cache, no-store, must-revalidate` regardless of profile.

The `/api/directus-file/[id]` route uses its own caching: `s-maxage=300, stale-while-revalidate=600` plus a 5-minute in-memory cache with concurrency limiting (max 10 concurrent requests to the Directus files API).

---

## 7. Content Management Workflows

### Publishing a Novel

1. Create a new item in the `novels` collection
2. Upload images: `cover` (portrait), `banner` (wide), `square` (thumbnail), `showcase` (hero)
3. Set M2M relations: select `genres` and `tags`
4. Write `synopsis` (markdown supported) and `one_liner`
5. Set `abbreviation` (URL slug — must be unique)
6. Set `author`, `serialization` status
7. Set `status` = `published` to make it live

### Adding Chapters

1. Create a new item in the `chapters` collection
2. Set `novel` relation to the parent novel
3. Set `chapter_number` (sequential within the novel)
4. Set `chapter_title`
5. Paste or write `chapter_content` (HTML/markdown)
6. Set `date_published` and `status` = `released`

### Managing the Homepage

- **Banner carousel:** Edit items in `showcases` — set image, linked novel, CTA text, tags, color palette. Only `published` items appear.
- **Featured section:** Add/remove/reorder items in `featured_novels` — each entry links to a novel.
- **Trending section:** Edit `trending_novels` — set `rank` (integer, 1 = top position) and link to novels.
- **Catalogue sections:** Edit `catalogue_spread` — set `title`, `position` (sort order), and manage linked novels through the `catalogue_spread_novels` junction. Lower `position` values appear first.

### Announcements

1. Create a new item in the `announcements` collection
2. Set `title` and `content` (markdown supported)
3. `date_created` is set automatically
4. Appears on the `/announcements` page immediately (10-second cache)

---

## 8. File Management

Directus stores **file metadata** (UUID, filename, dimensions, MIME type) but the actual file bytes are hosted in **Supabase Storage**. The file pipeline works as follows:

1. Files are uploaded through Directus admin → stored in Supabase Storage under the `directus/` bucket path
2. Directus records metadata including `filename_disk` (the actual filename on storage)
3. The `/api/directus-file/[id]` route fetches metadata from Directus (using the server-side token)
4. Client code uses `getAssetUrl()` to:
   - Fetch metadata via `/api/directus-file/[id]`
   - Extract `filename_disk` from the response
   - Construct the Supabase Storage URL: `{SUPABASE_STORAGE_API}/directus/{filename_disk}`
   - Optionally apply Cloudflare Image Transformations

See [07 — Image Pipeline](./07-Image-Pipeline.md) for the complete pipeline documentation.

---

## 9. Additional Directus Collections

The Directus instance contains many additional collections beyond those mapped in the frontend Schema type. These include operational tables managed by the application layer:

- **Junction tables:** `novels_genres`, `novels_tags`, `novels_languages`, `catalogue_spread_novels`, `chapters_languages`
- **User engagement:** `bookmarks`, `upvotes`, `comments`, `read_chapters`, `singularities`, `reviews`, `reading_lists`
- **Payments:** `payment_logs`, `payment_customers`, `wallets`, `helix_packs`, `chapter_purchases`, `subscriptions`
- **Platform features:** `quests`, `quest_progress`, `achievements`, `achievements_progress`, `badges`, `notifications`
- **Staff tools:** `ai_prompts`, `surveys`, `survey_responses`, `events`, `event_submissions`, `jobs`, `job_applications`
- **Legacy:** `site_currencies`, `memberships`, `orb_bundles` (migrated to new wallet/helix system)

These collections are primarily managed through Supabase (via RPC and direct queries) rather than the Directus API proxy routes, but their schemas are maintained in Directus for admin visibility and direct management where needed.
