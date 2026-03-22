---
id: "08-State-Management"
slug: "/08-State-Management"
sidebar_position: 8
sidebar_label: "State Management"
---

# 08 — State Management

> Three-layer state architecture: React Query for server state, React Context for global client state, and local state for component-level concerns.

---

## Table of Contents

- [Architecture](#architecture)
- [React Query Setup](#react-query-setup)
- [Query Keys](#query-keys)
- [React Query Hooks](#react-query-hooks)
- [Context Providers](#context-providers)
- [Custom Hooks](#custom-hooks)
- [Utility Libraries](#utility-libraries)
- [TypeScript Types](#typescript-types)
- [Cross-References](#cross-references)

---

## Architecture

State management in Genesis Studio is organized into three layers, each handling a different category of state:

| Layer | Tool | Scope | Examples |
|-------|------|-------|----------|
| **Server State** | React Query | CMS content, API data | Novels, chapters, showcases, rankings, comments |
| **Global Client State** | React Context | App-wide client state | Auth session, toast notifications, payment modals, comment reply/edit UI |
| **Local State** | `useState`, `localStorage` | Component-level | Reader settings, form inputs, scroll position |

### Why Three Layers?

- **React Query** handles caching, background refetching, stale-while-revalidate, and deduplication for all data that originates from the server. Components never manually manage loading/error states for API data.
- **React Context** is reserved for truly global client-side state that many components need (auth, toasts, modals). It is *not* used for server data.
- **Local state** is used for ephemeral UI state that doesn't need to be shared (form inputs, toggles, scroll positions, reader preferences persisted to `localStorage`).

---

## React Query Setup

### QueryProvider

**File:** `src/providers/QueryProvider.tsx`

Wraps the application with `QueryClientProvider` from `@tanstack/react-query`:

```tsx
<QueryClientProvider client={queryClient}>
  {children}
</QueryClientProvider>
```

### QueryClient Configuration

**File:** `src/lib/queryClient.ts`

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes — data considered fresh
      gcTime: 30 * 60 * 1000,           // 30 minutes — unused data kept in cache
      refetchOnWindowFocus: false,       // Don't refetch when tab regains focus
      refetchOnMount: false,             // Don't refetch if data is fresh (within staleTime)
      retry: 2,                          // Retry failed requests twice
    },
  },
});
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| `staleTime` | 5 minutes | CMS content changes infrequently; 5 minutes balances freshness with performance |
| `gcTime` | 30 minutes | Keeps data in memory for back-navigation without refetching |
| `refetchOnWindowFocus` | `false` | Prevents unnecessary refetches when users switch tabs |
| `refetchOnMount` | `false` | Components reusing cached fresh data don't trigger refetches |
| `retry` | `2` | Handles transient network failures without excessive retries |

---

## Query Keys

**File:** `src/lib/queryClient.ts`

The `queryKeys` object provides a structured, type-safe key factory for all queries:

```ts
const queryKeys = {
  novels: {
    all:        ["novels"],
    list:       ["novels", "list"],
    detail:     (abv: string) => ["novels", "detail", abv],
    trending:   ["novels", "trending"],
    completed:  ["novels", "completed"],
  },
  chapters: {
    all:        ["chapters"],
    list:       (novelAbv: string) => ["chapters", "list", novelAbv],
    detail:     (chapterId: string) => ["chapters", "detail", chapterId],
    recent:     (limit: number) => ["chapters", "recent", limit],
    recentPaid: (limit: number) => ["chapters", "recentPaid", limit],
    recentFree: (limit: number) => ["chapters", "recentFree", limit],
  },
  viewer: {
    all:        ["viewer"],
    chapter:    (chapterId: string) => ["viewer", "chapter", chapterId],
  },
  showcases: {
    all:        ["showcases"],
    published:  ["showcases", "published"],
  },
  releaseDays: {
    all:        ["releaseDays"],
    byDay:      (day: string) => ["releaseDays", day],
  },
  singularity: {
    all:        ["singularity"],
    rankings:   (limit?: number) => ["singularity", "rankings", limit],
    user:       (userId: string) => ["singularity", "user", userId],
  },
  genreSections: {
    all:        ["genreSections"],
  },
  eventBanner: {
    active:     ["eventBanner", "active"],
  },
  communityBanner: {
    current:    ["communityBanner", "current"],
  },
  genres: {
    all:        ["genres"],
  },
  catalogueSpread: {
    all:        ["catalogueSpread"],
  },
  recentlyFreed: {
    list:       (limit: number) => ["recentlyFreed", "list", limit],
  },
  comments: {
    all:        ["comments"],
    byChapter:  (chapterId: string, sort: string) => ["comments", "chapter", chapterId, sort],
    replies:    (commentId: string) => ["comments", "replies", commentId],
    count:      (chapterId: string) => ["comments", "count", chapterId],
  },
  user: {
    wallet:     (userId: string) => ["user", "wallet", userId],
    bookmarks:  (userId: string) => ["user", "bookmarks", userId],
    profile:    (userId: string) => ["user", "profile", userId],
  },
};
```

### Key Structure Convention

Keys follow a hierarchical pattern:

- **Top level:** resource type (`novels`, `chapters`, `user`)
- **Second level:** scope (`list`, `detail`, `all`)
- **Parameters:** dynamic segments passed as function arguments

This structure enables targeted invalidation. For example, `queryClient.invalidateQueries({ queryKey: queryKeys.novels.all })` invalidates all novel-related queries.

---

## React Query Hooks

**Directory:** `src/hooks/queries/`

### Novel Hooks

| Hook | Query Key | Endpoint | staleTime | Return Type | Used In |
|------|-----------|----------|-----------|-------------|---------|
| `useNovels` | `novels.list` | `/api/directus/novels` | 5min | `Novel[]` | Novels listing, homepage |
| `useNovel(abv)` | `novels.detail(abv)` | `/api/directus/novels/by-abbreviation/[abv]` | 10min | `Novel` | Novel detail page |
| `useNovelById(id)` | `novels.detail(id)` | `/api/directus/novels/by-id/[id]` | 10min | `Novel` | Novel references by ID |
| `useCompletedNovels` | `novels.completed` | `/api/directus/novels?status=completed` | 10min | `Novel[]` | CompletedTab |
| `useTrendingNovels` | `novels.trending` | `/api/directus/trending-novels` | 5min | `TrendingNovel[]` | TrendingSection |
| `useFeaturedNovels` | `featured_novels` | `/api/directus/featured-novels` | 5min | `Novel[]` | HomeTab |

### Chapter Hooks

| Hook | Query Key | Endpoint | staleTime | Return Type | Used In |
|------|-----------|----------|-----------|-------------|---------|
| `useChaptersByNovel(id)` | `chapters.list(id)` | `/api/novels-chapter/[id]` | 5min | `Chapter[]` | Novel detail page |
| `useChapterContent(id)` | `chapters.detail(id)` | `/api/chapters/[id]/content` | 10min | `ChapterContent` | Chapter viewer |
| `useRecentChapters(limit)` | `chapters.recent(limit)` | `/api/chapters/recent` | 2min | `Chapter[]` | RecentlyUpdated section |
| `useRecentlyFreed(limit)` | `recentlyFreed.list(limit)` | `/api/chapters/recently-freed` | 2min | `Chapter[]` | RecentlyUpdated section |

### CMS Content Hooks

| Hook | Query Key | Endpoint | staleTime | Return Type | Used In |
|------|-----------|----------|-----------|-------------|---------|
| `useShowcases` | `showcases.published` | `/api/directus/showcases` | 5min | `Showcase[]` | BannerCarousel |
| `useReleaseDays` | `releaseDays.all` | `/api/directus/release-days` | 10min | `ReleaseDayItem[]` | RecentsTab |
| `useGenreSections` | `genreSections.all` | `/api/directus/genre-sections` | 10min | `GenreSection[]` | Homepage genre sections |
| `useGenres` | `genres.all` | `/api/directus/genres` | 30min | `Genre[]` | Filter bars |
| `useCatalogueSpread` | `catalogueSpread.all` | `/api/directus/catalogue-spread` | 10min | `CatalogueSpreadSection[]` | CatalogueSections |
| `useCommunityBanner` | `communityBanner.current` | `/api/directus/community-banner` | 15min | `CommunityBanner` | Homepage banner |
| `useEventBanner` | `eventBanner.active` | `/api/directus/event-banners` | 5min | `EventBanner[]` | Homepage event banner |

### Engagement Hooks

| Hook | Query Key | Endpoint | staleTime | Return Type | Used In |
|------|-----------|----------|-----------|-------------|---------|
| `useSingularityRankings(limit?)` | `singularity.rankings(limit)` | `/api/singularity/rankings` | 2min | `SingularityRanking[]` | HallOfFameTab |

### Comment Hooks

| Hook | Query Key | Endpoint | staleTime | Return Type | Used In |
|------|-----------|----------|-----------|-------------|---------|
| `useComments(chapterId, sort, page, options?)` | `comments.byChapter(chapterId, sort)` | `/api/comments?chapterId=...&sort=...&page=...&limit=...` | 15s | `CommentsResponse` | `CommentFeed`, chapter viewer comments drawer |
| `useCommentReplies(commentId, page, options?)` | `comments.replies(commentId)` | `/api/comments/[commentId]/replies?page=...&limit=...` | 30s | `{ replies, total, has_more }` | `CommentCard` lazy reply expansion |

### Comment Mutation Hooks

All comment mutations live in `src/hooks/queries/useComments.ts` and invalidate the chapter-level comments query on success:

| Hook | Endpoint | Purpose |
|------|----------|---------|
| `useCreateComment(chapterId, sort)` | `POST /api/comments` | Create top-level comments and replies |
| `useEditComment(chapterId, sort)` | `PATCH /api/comments/[commentId]` | Edit owned comments |
| `useDeleteComment(chapterId, sort)` | `DELETE /api/comments/[commentId]` | Soft-delete owned comments |
| `useVoteComment(chapterId, sort)` | `POST /api/comments/[commentId]/vote` | Add, remove, or switch vote |
| `useReportComment()` | `POST /api/comments/[commentId]/report` | Send moderation report |

These hooks use an internal `getAuthHeaders()` helper that reads the current Supabase session and conditionally adds a Bearer token for authenticated actions.

---

## Context Providers

### AuthContext

**File:** `src/app/context/AuthContext.tsx`

Provides authentication state and methods to the entire application.

| Provided Value | Type | Description |
|----------------|------|-------------|
| `user` | `User \| null` | Current user or null |
| `isAuthenticated` | `boolean` | Whether user is logged in |
| `isLoading` | `boolean` | True during auth initialization |
| `login` | `(email, password) => Promise` | Email/password sign in |
| `signup` | `(email, password) => Promise` | Create account |
| `signInWithGoogle` | `() => Promise` | Google OAuth |
| `signInWithDiscord` | `() => Promise` | Discord OAuth |
| `logout` | `() => Promise` | Sign out |
| `fetchUserProfile` | `() => Promise` | Refresh profile from Directus |
| `resetPassword` | `(email) => Promise` | Send password reset email |
| `requireAuth` | `(callback?) => void` | Open login modal if not authenticated |

For full details, see [05 — Authentication System](./05-Authentication-System.md).

### ToastContext

**File:** `src/app/context/ToastContext.tsx`

Manages a notification toast queue rendered at the top-right corner of the viewport.

#### Provided Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `showToast` | `(toast: ToastData) => void` | Show a toast with full control |
| `showSuccess` | `(title, msg?, duration?) => void` | Green success toast |
| `showError` | `(title, msg?, duration?) => void` | Red error toast |
| `showWarning` | `(title, msg?, duration?) => void` | Yellow warning toast |
| `showInfo` | `(title, msg?, duration?) => void` | Blue info toast |

#### ToastData

```ts
interface ToastData {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}
```

#### Configuration

| Setting | Value |
|---------|-------|
| Max visible toasts | 5 |
| Default duration | 5000ms |
| Position | Fixed `top-4 right-4` |
| Z-index | `10002` (above modals) |

### ModalViewboxContext

**File:** `src/app/context/ModalViewboxContext.tsx`

Stack-based modal system for payment flows.

#### Modal Types

| Type | Component | Purpose |
|------|-----------|---------|
| `novel-subscription` | NovelSubscriptionContent | Subscribe to a novel |
| `helix-unlock` | HelixUnlockContent | Unlock chapter with Helix |
| `helix-purchase` | HelixPurchaseContent | Buy Helix packs |
| `unlock-options` | UnlockOptionsContent | Choose unlock method |
| `insufficient-helix` | InsufficientHelixContent | Not enough Helix |

#### Provided Values

| Value | Type | Description |
|-------|------|-------------|
| `stack` | `ModalEntry[]` | Full modal stack |
| `isOpen` | `boolean` | Whether any modal is showing |
| `canGoBack` | `boolean` | Whether stack has more than one entry |
| `currentModal` | `ModalEntry \| null` | Top of the stack |
| `openModal` | `(type, props) => void` | Push modal onto stack |
| `goBack` | `() => void` | Pop top modal |
| `close` | `() => void` | Clear entire stack |

For full details, see [06 — Payment & Subscription System](./06-Payment-Subscription-System.md).

### CommentSectionContext

**File:** `src/app/components/comments/context/CommentSectionContext.tsx`

Feature-local context for the chapter comments UI.

#### Provided Values

| Value | Type | Description |
|-------|------|-------------|
| `chapterId` | `string` | Active chapter identifier |
| `currentUserId` | `string \| null` | Current authenticated user |
| `sort` | `CommentSort` | Current feed ordering (`top`, `new`, `old`) |
| `setSort` | `(sort) => void` | Update sort mode |
| `replyTarget` | `Comment \| null` | Comment currently being replied to |
| `setReplyTarget` | `(comment) => void` | Enter reply mode |
| `clearReply` | `() => void` | Exit reply mode |
| `editTarget` | `Comment \| null` | Comment currently being edited |
| `setEditTarget` | `(comment) => void` | Enter edit mode |
| `clearEdit` | `() => void` | Exit edit mode |
| `isInputFocused` | `boolean` | Signals the input to focus itself |
| `setIsInputFocused` | `(focused) => void` | Trigger composer focus |

This context exists because comment reply/edit state spans multiple sibling components (`CommentCard`, `CommentActionMenu`, `CommentReplyButton`, `CommentInput`) and would be awkward to manage through prop-drilling alone.

---

## Custom Hooks

**Directory:** `src/hooks/`

### useActiveTab

**File:** `src/hooks/useActiveTab.ts`

Manages the active tab on the homepage. Syncs state with the URL hash so tab selection persists across navigation.

| Param | Type | Description |
|-------|------|-------------|
| — | — | No parameters |

| Return | Type | Description |
|--------|------|-------------|
| `activeTab` | `string` | Currently active tab identifier |
| `setActiveTab` | `(tab: string) => void` | Switch to a different tab |

Reads the URL hash on mount and updates it when the tab changes.

### useBookmarkToggle

**File:** `src/hooks/useBookmarkToggle.ts`

Toggles bookmark state for a novel with optimistic updates.

| Param | Type | Description |
|-------|------|-------------|
| `novelId` | `string` | The novel to bookmark/unbookmark |
| `userId` | `string` | The current user's ID |

| Return | Type | Description |
|--------|------|-------------|
| `isBookmarked` | `boolean` | Current bookmark state |
| `toggle` | `() => void` | Toggle bookmark on/off |
| `isLoading` | `boolean` | True during API call |

Calls `POST /api/bookmark` to persist changes. Uses optimistic updates — the UI reflects the change immediately, rolling back on failure.

### useDarkMode

**File:** `src/hooks/useDarkMode.ts`

Detects the current theme by watching for the `theme-dark` class on the `<html>` element.

| Param | Type | Description |
|-------|------|-------------|
| — | — | No parameters |

| Return | Type | Description |
|--------|------|-------------|
| `isDarkMode` | `boolean` | Whether dark mode is active |

Uses a `MutationObserver` on `document.documentElement` to reactively update when the theme class changes. This avoids polling and responds instantly to theme toggles.

### useImagePreload

**File:** `src/hooks/useImagePreload.ts`

Circular buffer image preloader for carousels and sequential image viewing.

| Param | Type | Description |
|-------|------|-------------|
| `imageUrls` | `string[]` | Array of image URLs to manage |
| `options` | `object` | Buffer size, priority, etc. |

| Return | Type | Description |
|--------|------|-------------|
| `isPreloaded` | `(url: string) => boolean` | Check if a specific URL is preloaded |

Key implementation details:

- Configurable buffer size controls how many images are preloaded ahead/behind.
- Priority levels (`high`, `low`) control browser fetch priority.
- `AbortController` cancels in-flight preloads when the component unmounts or the carousel moves.
- LRU eviction kicks in at 100 cached images to prevent memory bloat.

### useScrollBehavior

**File:** `src/hooks/useScrollBehavior.ts`

Tracks scroll direction and velocity for auto-hiding the navigation bar.

| Param | Type | Description |
|-------|------|-------------|
| — | — | No parameters |

| Return | Type | Description |
|--------|------|-------------|
| `scrollDirection` | `"up" \| "down"` | Current scroll direction |
| `isScrolling` | `boolean` | Whether the user is actively scrolling |

Uses velocity-based animation duration — faster scrolls trigger quicker navbar hide/show animations. Debounced to avoid jitter on slow scrolls.

### useUserSingularity

**File:** `src/hooks/useUserSingularity.ts`

Fetches the user's singularity (ranking) placement.

| Param | Type | Description |
|-------|------|-------------|
| `userId` | `string` | The user's ID |

| Return | Type | Description |
|--------|------|-------------|
| `novelId` | `string \| null` | The novel the user placed on |
| `canMove` | `boolean` | Whether the user can change their placement |
| `place` | `number \| null` | Current ranking position |
| `isLoading` | `boolean` | True during fetch |

Calls `/api/singularity` to get the user's current singularity state.

### useWallet

**File:** `src/hooks/useWallet.ts`

Fetches the user's wallet balance.

| Param | Type | Description |
|-------|------|-------------|
| `userId` | `string` | The user's ID |

| Return | Type | Description |
|--------|------|-------------|
| `helix` | `number` | Current Helix balance |
| `atoms` | `number` | Current Atoms balance |
| `refresh` | `() => void` | Manually refresh balance |
| `isLoading` | `boolean` | True during fetch |

Calls `/api/wallet/balance` to get the current balance.

---

## Utility Libraries

**Directory:** `src/lib/`

### api-utils.ts

Shared utilities for API route responses and caching:

| Export | Purpose |
|--------|---------|
| `CacheProfile` | Type defining cache strategy (`"static"`, `"dynamic"`, `"realtime"`, `"user"`) |
| `jsonWithCache(data, profile, status)` | Returns a JSON `Response` with appropriate `Cache-Control` headers |
| `errorResponse(message, status)` | Returns a standardized error JSON `Response` |
| `getCacheHeaders(profile)` | Returns `Cache-Control` header string for a given profile |
| `CACHE_PROFILE_GUIDE` | Lookup object describing which endpoints use each cache profile |

#### Realtime cache profile

The comments API uses the `realtime` cache profile:

```ts
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
```

That short cache window is paired with React Query polling in `CommentFeed` for near-realtime chapter discussions.

### auth-utils.ts

Authentication helper functions:

| Export | Purpose |
|--------|---------|
| `extractUserData(session \| user)` | Normalizes user data from either a Supabase session or user object into a consistent shape |
| `createSafeSessionHandler()` | Creates a wrapper for safe session access that handles expired sessions and race conditions |

### utils.ts

General-purpose utilities:

| Export | Purpose |
|--------|---------|
| `cn(...inputs)` | Combines `clsx` and `tailwind-merge` for conditional class name merging. Standard shadcn/ui pattern. |

```ts
import { cn } from "@/lib/utils";

<div className={cn("base-class", isActive && "active-class", className)} />
```

### novelCache.ts

Client-side in-memory cache for novel data:

| Feature | Detail |
|---------|--------|
| TTL | 5 minutes |
| Scope | Module-level (persists across renders) |
| Use case | Quick repeat access on novel detail pages — avoids React Query cache lookup overhead for hot data |

### environment-utils.ts

Environment detection helpers for determining runtime context (development, staging, production) and feature flag evaluation.

### analytics.ts

Vercel Analytics event tracking helpers. Provides typed wrappers around `track()` for common user actions (page views, purchases, chapter reads).

---

## TypeScript Types

**Directory:** `src/types/`

| File | Types Defined | Used By |
|------|---------------|---------|
| `novel.ts` | `Genre`, `GenreRelation`, `NovelCardData`, `Novel` | Novel cards, detail pages, listings |
| `payment.ts` | `PaymentStatus`, `PaymentType`, `PaymentProvider`, `PaymentLog`, `TransactionHistoryItem`, `UserSpendingSummary` | Payment flows, transaction history |
| `comments.ts` | `Comment`, `CommentAuthor`, `CommentSort`, `CommentsResponse`, `CreateCommentPayload`, `EditCommentPayload`, `VotePayload`, `ReportPayload` | Comments API, UI components, query hooks |
| `singularity.ts` | `SingularityRanking`, `UserSingularity` | Hall of Fame, singularity buttons |
| `catalogue-spread.ts` | `CatalogueSpreadSection` | Homepage catalogue sections |
| `cms-banners.ts` | `EventBanner`, `CommunityBanner` | Homepage banner components |
| `color-palette.ts` | `ThemeColors`, `ColorPalette`, `parseColorPalette()` | Novel theming, showcase cards |
| `genre-section.ts` | `GenreSectionNovel`, `GenreSection` | Homepage genre sections |
| `release-days.ts` | `DayOfWeek`, `ReleaseDayItem` | Recents tab |
| `showcase.ts` | `Showcase` | Banner carousel |

### Key Type Details

#### Novel Types (`novel.ts`)

```ts
interface Novel {
  id: string;
  title: string;
  abbreviation: string;
  cover: string;           // Directus file UUID
  status: string;
  genres: GenreRelation[];
  color_palette: unknown;  // Parsed via parseColorPalette()
  // ... additional fields
}

interface NovelCardData {
  // Subset of Novel for card rendering
}
```

#### Payment Types (`payment.ts`)

```ts
type PaymentStatus = "succeeded" | "failed" | "pending" | "refunded";
type PaymentType = "helix_purchase" | "subscription" | "chapter_unlock";
type PaymentProvider = "stripe" | "paypal";

interface TransactionHistoryItem {
  id: string;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  created_at: string;
  // ... additional fields
}
```

#### Color Palette Types (`color-palette.ts`)

```ts
interface ThemeColors {
  primary: string;
  secondary: string;
}

interface ColorPalette {
  light: ThemeColors;
  dark: ThemeColors;
}

function parseColorPalette(data: unknown): ColorPalette;
```

---

## Cross-References

- **[05 — Authentication System](./05-Authentication-System.md):** Full AuthContext documentation, login flows, session management.
- **[06 — Payment & Subscription System](./06-Payment-Subscription-System.md):** ModalViewboxContext details, payment flows, Stripe/PayPal integration.
- **[09 — UI: Homepage](./09-UI-Homepage.md):** Components that consume homepage and singularity query hooks.
- **[11 — UI: Novel Detail](./11-UI-Novel-Detail.md):** Novel-specific query hooks, bookmark state, and chapter list state.
- **[12 — UI: Chapter Viewer](./12-UI-Chapter-Viewer.md):** Chapter content loading and reader state.
- **[13 — UI: Comments System](./13-UI-Comments-System.md):** Comment query hooks, mutations, and `CommentSectionContext`.
- **[15 — UI: Library](./15-UI-Library.md):** User-specific hooks such as wallet, bookmarks, and subscriptions.
- **[16 — UI: Common Components](./16-UI-Common-Components.md):** Shared contexts, toasts, and modal patterns.
