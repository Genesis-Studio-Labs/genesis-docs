---
id: "11-UI-Novel-Detail"
slug: "/11-UI-Novel-Detail"
sidebar_position: 11
sidebar_label: "UI: Novel Detail"
---

# 11 — UI: Novel Detail Page

> The novel detail page is the primary information page for a single novel. It displays cover art, metadata, synopsis, chapter listings with access control, and action buttons for reading, bookmarking, voting, and subscribing. The page uses abbreviation-based URL slugs and supports dynamic OG image generation.

---

## Table of Contents

- [Page Structure](#page-structure)
- [Data Fetching](#data-fetching)
- [Layout](#layout)
- [Components](#components)
- [Chapter Access Logic](#chapter-access-logic)
- [Interaction Flows](#interaction-flows)
- [Loading States](#loading-states)
- [Cross-References](#cross-references)

---

## Page Structure

**Route:** `/novels/[abv]` — abbreviation-based slugs (e.g., `/novels/ror` for "Rise of Ruin")

**File:** `src/app/novels/[abv]/page.tsx`

Directive: `"use client"`

### Dynamic OG Image

**File:** `src/app/novels/[abv]/opengraph-image.tsx`

Server-side generated Open Graph image using Next.js `ImageResponse`. Renders the novel cover, title, and branding into a 1200x630 image for social sharing.

### Page Composition

```tsx
<Navigation />
{loading ? <NovelDetailSkeleton /> : (
  <>
    {/* Mobile Layout (< lg) */}
    {/* Desktop Layout (>= lg) */}
    {chaptersLoading ? <ChaptersSkeleton /> : (
      <CombinedChaptersAccordion ... />
    )}
    {novelHasSubscription && <SubscriptionBanner ... />}
  </>
)}
<Footer />
```

### Key Imports

| Import | Source | Purpose |
|--------|--------|---------|
| `useAuth` | `context/AuthContext` | User authentication state |
| `useToast` | `context/ToastContext` | Toast notification feedback |
| `useModalViewbox` | `context/ModalViewboxContext` | Opens unlock/subscription modals |
| `useWallet` | `hooks/useWallet` | Helix balance and chapter unlock |
| `getCachedNovel` | `lib/novelCache` | Cached novel data fetching |
| `CombinedChaptersAccordion` | `components/novel-detail/CombinedChaptersAccordion` | Chapter listing with premium/free sections |
| `SubscriptionBanner` | `components/novel-detail/SubscriptionBanner` | Subscription CTA banner |
| `MarkdownRenderer` | `components/MarkdownRenderer` | Renders CMS markdown synopsis |
| `NovelDetailSkeleton` | `components/skeletons/NovelDetailSkeleton` | Page-level loading skeleton |
| `ChaptersSkeleton` | `components/skeletons/ChaptersSkeleton` | Chapter list loading skeleton |

---

## Data Fetching

### Novel Data

Fetched via `getCachedNovel(abbreviation)` which uses the novel cache layer backed by `/api/directus/novels/by-abbreviation/[abv]`. If the novel is not found or not published, the user is redirected to `/404`.

### Chapters

Fetched via `/api/chapters/by-novel/{novelId}` after the novel data resolves. Includes access control information:
- `isPaid` — whether the chapter is behind the paywall
- `isUnlocked` — whether the authenticated user has purchased this chapter
- `helixCost` — cost in Helix (100 for paid chapters)
- `hasSubscription` — whether the user has an active subscription for this novel
- `isRead` — whether the user has read this chapter

### Additional State

| Data | Source | Purpose |
|------|--------|---------|
| Bookmark state | `/api/bookmark` API + local state | Whether the user has bookmarked this novel |
| Bookmark count | Novel data | Total bookmark count for display |
| Singularity state | `/api/singularity` API | Whether the user's vote is on this novel |
| Singularity count | Novel data | Total singularity vote count |
| Helix balance | `useWallet(userId)` | User's Helix balance for unlock operations |
| Read progress | Chapter read status | Determines "Continue Ch. X" vs "Start Reading" |
| Image URLs | `getAssetUrl()` | Resolved Cloudflare CDN URLs for cover, banner, square images |
| Dark mode | `MutationObserver` on `<html>` class | Theme detection for conditional styling |
| Color palette | `novel.color_palette` | Dynamic accent colors parsed from CMS data |

### Novel Interface

```ts
interface Novel {
  id: string;
  status: string;
  novel_title: string;
  synopsis: string;
  cover: string;
  year: number;
  author: string;
  serialization: string;
  abbreviation: string;
  showcase: string;
  banner: string;
  chapter_numbers: number;
  available_tiers: number;
  last_updated: string;
  total_views: number;
  rating: number | null;
  square: string;
  one_liner: string;
  latest_free_chapter: number;
  latest_free_chapter_date: string | null;
  page_views: number;
  original: string;
  color_palette: string[] | null;
  has_subscription?: boolean;
  genres: number[];
  languages: Language[];
  tags: number[];
  notices: Notice[];
}
```

### Chapter Interface

```ts
interface Chapter {
  id: number;
  chapter_number: number;
  chapter_title: string;
  status: string;
  isPaid?: boolean;
  isUnlocked?: boolean;
  helixCost?: number;
  hasSubscription?: boolean;
  isRead?: boolean;
}
```

---

## Layout

The novel detail page renders two completely separate layout branches based on viewport width.

### Mobile Layout (visible < lg)

```
┌─────────────────────────────┐
│  Cover Section              │
│  ┌───────────────────────┐  │
│  │ Bokeh blur background │  │
│  │   ┌─────────────┐     │  │
│  │   │ Novel Cover │     │  │
│  │   └─────────────┘     │  │
│  │ Title, Author, Status  │  │
│  └───────────────────────┘  │
│                             │
│  Star Rating Display        │
│                             │
│  Synopsis (collapsible)     │
│                             │
│  Action Buttons:            │
│  [Start Reading / Continue] │
│  [Bookmark] [Singularity]   │
│                             │
│  CombinedChaptersAccordion  │
│                             │
│  SubscriptionBanner (if     │
│   novel has subscription)   │
└─────────────────────────────┘
```

- **Cover Section:** Novel cover centered with a bokeh-blurred background effect — the cover image is rendered at full bleed with heavy blur (`backdrop-blur`) and a gradient overlay, then the sharp cover is layered on top
- **Synopsis:** Collapsible with show more/less toggle. Content rendered via `MarkdownRenderer` from CMS markdown
- **Status Badge:** Visual indicator for serialization status (Ongoing / Completed / Hiatus)

### Desktop Layout (visible >= lg)

```
┌──────────────────────────────────────────────┐
│  Two-Column Grid                             │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │              │  │ Title (h1)           │  │
│  │  Novel Cover │  │ Author               │  │
│  │  with Bokeh  │  │ Genre Tags (links)   │  │
│  │  Blur Effect │  │ Stats Row            │  │
│  │              │  │ One-liner            │  │
│  │              │  │ Synopsis (collapse)  │  │
│  │              │  │ Action Buttons       │  │
│  └──────────────┘  └──────────────────────┘  │
│                                              │
│  CombinedChaptersAccordion (full width)      │
│                                              │
│  SubscriptionBanner (full width, if has sub) │
└──────────────────────────────────────────────┘
```

- **Left Column:** Novel cover with bokeh blur background effect
- **Right Column:** All metadata, stats, synopsis, and action buttons
- **Genre Tags:** Rendered as links (navigate to filtered novels listing)
- **Stats Row:** Chapter count, total views (`formatCount`), rating (star display), singularity count

---

## Components

### CombinedChaptersAccordion

**File:** `src/app/components/novel-detail/CombinedChaptersAccordion.tsx`

The primary chapter listing component with collapsible premium/free sections.

```ts
interface CombinedChaptersAccordionProps {
  premiumChapters: Chapter[];
  freeChapters: Chapter[];
  squareImage: string;
  novelAbbreviation: string;
  hasNovelSubscription: boolean;
  onOpenUnlockModal: (chapterId: number) => void;
  colorPalette?: string[];
}
```

#### Sections

| Section | Content | Default Sort |
|---------|---------|--------------|
| **Premium Chapters** | Paid chapters (latest ~50) | Descending (newest first) |
| **Free Chapters** | Free chapters (all older chapters) | Descending (newest first) |

#### Features

- **Collapsible Accordion:** Only one section open at a time (`openSection: 'premium' | 'free' | null`)
- **Sort Toggle:** Each section has an independent asc/desc sort toggle, persisted to `localStorage` per novel (`novel-{abbreviation}-sort-{section}`)
- **Chapter Row Icons:**
  - Unlocked/free: Open link icon
  - Purchased: Checkmark icon
  - Locked: `Lock` icon + Helix cost display
  - Read: Visual read indicator
- **Locked Chapter Click:** Calls `onOpenUnlockModal(chapterId)` which opens the `ModalViewbox` with unlock options
- **Free Chapter Click:** Direct `Link` to `/viewer/{chapterId}`
- **Color Palette:** Uses `colorPalette[0]` as the primary accent color for section headers and highlights
- **Framer Motion:** `AnimatePresence` for smooth accordion open/close transitions with `ChevronDown`/`ChevronUp` icons

#### State

| State | Type | Purpose |
|-------|------|---------|
| `openSection` | `'premium' \| 'free' \| null` | Currently expanded section |
| `premiumSortOrder` | `'asc' \| 'desc'` | Premium section sort (localStorage-persisted) |
| `freeSortOrder` | `'asc' \| 'desc'` | Free section sort (localStorage-persisted) |

---

### NovelCover

**File:** `src/app/components/novel-detail/NovelCover.tsx`

Renders the novel cover with a bokeh blur background effect.

| Prop | Type | Purpose |
|------|------|---------|
| `cover` | `string` | Directus asset ID for the cover image |
| `colorPalette` | `string[]` | Color palette for gradient overlay tints |

Renders:
1. Blurred background: cover image at full size with heavy CSS blur + gradient overlay
2. Sharp cover: clean cover image centered on top

Uses `getAssetUrl()` for image URL resolution.

---

### NovelInfo

**File:** `src/app/components/novel-detail/NovelInfo.tsx`

Displays novel metadata and synopsis.

| Prop | Type | Purpose |
|------|------|---------|
| `novel` | `Novel` | Full novel data object |
| `chapters` | `Chapter[]` | Chapter list for count display |

Renders: title, author name, serialization status badge, genre tags as links, one-liner, synopsis with expand/collapse toggle.

---

### NovelStats

**File:** `src/app/components/novel-detail/NovelStats.tsx`

A row of statistical badges.

| Prop | Type | Purpose |
|------|------|---------|
| `chapterCount` | `number` | Total number of chapters |
| `views` | `number` | Total views (formatted with `formatCount`) |
| `rating` | `number` | Star rating value |
| `singularityCount` | `number` | Total singularity votes |

Renders as a horizontal row of icon + value badges using lucide-react icons (`Eye`, `Calendar`, `Star`, `Bookmark`).

---

### SubscriptionBanner

**File:** `src/app/components/novel-detail/SubscriptionBanner.tsx`

A CTA banner encouraging users to subscribe for full chapter access.

| Prop | Type | Purpose |
|------|------|---------|
| `novelId` | `string` | Novel ID for subscription |
| `novelTitle` | `string` | Novel title for display |

- Only rendered when `novel.has_subscription === true`
- CTA button opens `ModalViewbox` with `novel-subscription` content type
- Styled with the novel's color palette accent colors

---

### NovelSubscriptionModal

**File:** `src/app/components/novel-detail/NovelSubscriptionModal.tsx`

Modal component for the novel subscription purchase flow. Opened via `ModalViewboxContext` when the user clicks "Subscribe" on the `SubscriptionBanner` or in the `LockedChapterView`.

Contains the subscription plan details, pricing, and initiates the Stripe checkout flow.

---

### ChaptersAccordion / ChaptersList

**Files:** `src/app/components/novel-detail/ChaptersAccordion.tsx`, `src/app/components/novel-detail/ChaptersList.tsx`

Sub-components used within `CombinedChaptersAccordion`:
- `ChaptersAccordion`: Handles the collapsible section logic with volume/arc grouping
- `ChaptersList`: Renders the flat list of chapter rows within an accordion section

---

## Chapter Access Logic

Chapters follow a tiered access model:

### Access Tiers

| Tier | Criteria | Cost | Visual Indicator |
|------|----------|------|-----------------|
| **Free** | All chapters except the latest ~50 (or CMS-configured threshold via `latest_free_chapter`) | Free | Open/link icon |
| **Paid** | Latest ~50 chapters | 100 Helix each | Lock icon + "100" cost badge |
| **Subscribed** | All chapters when user has active novel subscription | Subscription price | Unlocked (no lock icon) |
| **Purchased** | Individual chapters the user has bought with Helix | Already paid | Checkmark icon |

### Sequential Unlock Rule

Users must own all previous paid chapters before purchasing the next one. If a user tries to unlock Chapter 55 but hasn't purchased Chapters 51–54, the unlock modal shows the required preceding chapters and total Helix cost.

### Access Decision Tree

```
Is chapter in the free range? ──YES──→ ✅ Free access
         │
         NO
         │
Does user have active subscription? ──YES──→ ✅ Subscribed access
         │
         NO
         │
Has user purchased this chapter? ──YES──→ ✅ Purchased access
         │
         NO
         │
         → 🔒 Locked — show Helix cost + unlock CTA
```

---

## Interaction Flows

### Bookmarking

1. User clicks `BookmarkButton` (uses the same component from `homepage/shared/BookmarkButton.tsx`)
2. If not authenticated → shows warning toast + `LoginModal`
3. If authenticated → calls `POST /api/bookmark` with novel ID
4. Toast feedback: "Added to Library" or "Removed from Library"
5. Bookmark count updates locally
6. Analytics event: `trackBookmark`

### Singularity Voting

1. User clicks `SingularityButton`
2. If not authenticated → shows warning toast + `LoginModal`
3. If authenticated → opens `SingularityConfirmDialog`
4. Dialog shows current vote status (if voting for the first time or moving from another novel)
5. On confirm → calls singularity API to place/move vote
6. Singularity count updates locally
7. Analytics event: `trackSingularity`

### Start Reading / Continue Reading

Dynamic CTA button based on read progress:

| State | Button Text | Action |
|-------|-------------|--------|
| No chapters read | "Start Reading" | Navigate to `/viewer/{firstChapterId}` |
| Has read progress | "Continue Ch. \{X\}" | Navigate to `/viewer/{nextUnreadChapterId}` |

### Unlock Chapter

1. User clicks a locked chapter row in `CombinedChaptersAccordion`
2. `onOpenUnlockModal(chapterId)` is called
3. `ModalViewbox` opens with `UnlockOptionsContent`
4. If user has enough Helix → shows `HelixUnlockContent` with confirm button
5. If insufficient Helix → shows `InsufficientHelixContent` with top-up options
6. If sequential chapters required → shows required chapters list + total cost
7. On successful unlock → chapter access state updates, toast confirmation
8. Analytics events: `trackChapterUnlockAttempt`, `trackFunnelStep`

### Subscribe

1. User clicks "Subscribe" on `SubscriptionBanner` or `LockedChapterView`
2. `ModalViewbox` opens with `NovelSubscriptionContent`
3. Subscription plan details and pricing displayed
4. User confirms → redirected to Stripe checkout
5. On successful return → subscription state updates, all chapters unlocked
6. Analytics event: `trackSubscriptionView`

---

## Loading States

### NovelDetailSkeleton

**File:** `src/app/components/skeletons/NovelDetailSkeleton.tsx`

Renders separate mobile and desktop layout skeletons:

**Mobile:** Cover rectangle placeholder + title/author text lines + stat badges row + synopsis lines + action button placeholders

**Desktop:** Two-column grid with cover rectangle (left) + metadata text lines, stats, synopsis, buttons (right)

### ChaptersSkeleton

**File:** `src/app/components/skeletons/ChaptersSkeleton.tsx`

Renders accordion section header placeholders + chapter row shimmer lines.

### Loading Sequence

```
1. Page mounts, abbreviation extracted from URL params
2. Novel data fetched via getCachedNovel() → NovelDetailSkeleton shown
3. Novel loaded → layout renders, chapters fetch begins → ChaptersSkeleton shown
4. Chapters loaded → full page interactive
5. Image URLs resolved in parallel (prefetchFileMetadata + getAssetUrl)
6. Bookmark/singularity/subscription state fetched asynchronously
```

---

## Cross-References

- **[06 — Payment & Subscription System](./06-Payment-Subscription-System.md):** Helix unlock flow, Stripe subscription checkout, `ModalViewboxContext` modal types.
- **[08 — State Management](./08-State-Management.md):** `useWallet` hook, `useBookmarkToggle` hook, `useAuth` context, `useToast` context, novel cache layer.
- **[12 — UI: Chapter Viewer](./12-UI-Chapter-Viewer.md):** The viewer page that chapters link to (`/viewer/[chapterId]`), including locked chapter handling and reader settings.
