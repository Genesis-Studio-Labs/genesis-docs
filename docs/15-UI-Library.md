---
id: "15-UI-Library"
slug: "/15-UI-Library"
sidebar_position: 15
sidebar_label: "UI: Library"
---

# 15 — UI: Library Page

> The authenticated user's personal library — bookmarked novels and active subscriptions — displayed in a tabbed interface with data fetched via React Query.

---

## Table of Contents

- [Page Structure](#page-structure)
- [Authentication Gate](#authentication-gate)
- [Tabs & Sections](#tabs--sections)
- [Data Flow](#data-flow)
- [Components](#components)
- [Cross-References](#cross-references)

---

## Page Structure

| Aspect | Detail |
|--------|--------|
| **Server Component** | `src/app/library/page.tsx` — exports metadata, renders `LibraryClient` |
| **Client Component** | `src/app/library/LibraryClient.tsx` — all interactive library logic |
| **Route** | `/library` |
| **Auth Required** | Yes — unauthenticated users see a login prompt |

---

## Authentication Gate

The library page is gated behind authentication. Access control is handled client-side using the `useAuth()` hook from `AuthContext`.

### Flow

```
User navigates to /library
  → LibraryClient mounts
    → useAuth() checks isAuthenticated
      ├─ true  → Render library content (tabs, data)
      └─ false → Render login prompt
```

### Unauthenticated State

When `isAuthenticated` is `false`:

- A centered prompt is displayed: **"Sign in to access your library"**
- A button triggers the `LoginModal` (from `src/app/components/auth/LoginModal.tsx`)
- The modal provides Sign In / Sign Up flows, OAuth (Google, Discord), and email/password
- After successful authentication, the library content loads automatically as `isAuthenticated` flips to `true`

### Authenticated State

When `isAuthenticated` is `true`:

- The full library UI renders with two tabs: Bookmarks and Subscriptions
- React Query hooks fire to fetch user-specific data

---

## Tabs & Sections

The library has two tabs, each displaying a different category of the user's saved content.

### Bookmarks Tab

| Aspect | Detail |
|--------|--------|
| **API Endpoint** | `GET /api/bookmark` (auth required) |
| **Response** | User's bookmarked novels enriched with Directus novel data |
| **Display** | Responsive grid of `NovelCard` components |
| **Card Link** | Each card navigates to `/novels/[abbreviation]` |
| **Empty State** | "No bookmarks yet. Start exploring novels!" |

The bookmarks endpoint returns the user's saved novels with full metadata (title, cover image, abbreviation, synopsis) sourced from Directus CMS. Each result maps to a `NovelCard` — the same component used on the homepage — ensuring visual consistency across the site.

### Subscriptions Tab

| Aspect | Detail |
|--------|--------|
| **API Endpoint** | `GET /api/unlocked/subscriptions` (auth required) |
| **Response** | Active novel subscriptions with associated novel data |
| **Display** | Responsive grid of novel cards with subscription indicators |
| **Empty State** | "No active subscriptions." |

Each subscription card displays:

| Element | Detail |
|---------|--------|
| Novel cover | Cover image from Directus/Cloudflare CDN |
| Title | Novel name |
| Subscription status | Badge: **Active** (green) or **Expired** (gray) |
| Renewal date | Next billing date for active subscriptions |

Cards link to the novel's detail page at `/novels/[abbreviation]`.

---

## Data Flow

### Fetching Strategy

Both tabs fetch data in parallel on component mount using React Query:

```ts
// Bookmarks query
const { data: bookmarks, isLoading: bookmarksLoading } = useQuery({
  queryKey: ['bookmarks'],
  queryFn: () => fetch('/api/bookmark').then(res => res.json()),
  enabled: isAuthenticated,
});

// Subscriptions query
const { data: subscriptions, isLoading: subsLoading } = useQuery({
  queryKey: ['subscriptions'],
  queryFn: () => fetch('/api/unlocked/subscriptions').then(res => res.json()),
  enabled: isAuthenticated,
});
```

Key behaviors:

- Both queries are **enabled only when authenticated** (`enabled: isAuthenticated`)
- Queries fire in **parallel** — neither depends on the other
- React Query handles caching, deduplication, and background refetching

### State Handling

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton grid (shimmer placeholders matching card layout dimensions) |
| **Error** | Error message with a "Retry" button that triggers `refetch()` |
| **Empty** | Friendly message with a CTA to browse novels (links to `/novels`) |
| **Success** | Responsive grid of novel cards |

---

## Components

The library page reuses shared components wherever possible to maintain visual consistency:

| Component | Source | Usage |
|-----------|--------|-------|
| `NovelCard` | `src/app/components/homepage/shared/` | Individual novel card (cover, title, metadata) |
| `NovelCardGrid` | `src/app/components/homepage/shared/` | Responsive grid wrapper for novel cards |
| `Navbar` | `src/app/components/common/Navbar.tsx` | Top navigation bar |
| `Footer` | `src/app/components/common/Footer.tsx` | Page footer |
| `LoginModal` | `src/app/components/auth/LoginModal.tsx` | Authentication modal for unauthenticated users |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Base skeleton for loading states |

No library-specific components are introduced — the page composes entirely from shared building blocks.

---

## Cross-References

| Doc | Relevance |
|-----|-----------|
| [05 — Authentication System](./05-Authentication-System.md) | Auth flow, LoginModal, useAuth hook, session management |
| [08 — State Management](./08-State-Management.md) | React Query hooks, query keys, AuthContext |
| [09 — UI: Homepage](./09-UI-Homepage.md) | NovelCard and NovelCardGrid shared components |
