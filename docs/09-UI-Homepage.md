---
id: "09-UI-Homepage"
slug: "/09-UI-Homepage"
sidebar_position: 9
sidebar_label: "UI: Homepage"
---

# 09 — UI: Homepage

> The homepage is the primary landing experience for Genesis Studio. It uses a tab-based architecture that renders all panels simultaneously (hidden via CSS) to preserve mounted state and prevent refetching when switching tabs.

---

## Table of Contents

- [Page Structure](#page-structure)
- [Tab System](#tab-system)
- [Home Tab](#home-tab)
- [Recents Tab](#recents-tab)
- [Hall of Fame Tab](#hall-of-fame-tab)
- [Completed Tab](#completed-tab)
- [Shared Homepage Components](#shared-homepage-components)
- [Loading States](#loading-states)
- [Cross-References](#cross-references)

---

## Page Structure

**Route:** `/` (homepage)

The homepage is split into a server component (metadata + Suspense boundary) and a client component (interactive tab UI).

### Server Component

**File:** `src/app/page.tsx`

- Sets page metadata (title, description) for SEO
- Injects WebSite JSON-LD schema with `SearchAction` for Google sitelinks search
- Renders `HomeClient` inside a `<Suspense>` boundary with a minimal fallback (`min-h-screen` colored div)

```tsx
<Suspense fallback={<div className="min-h-screen bg-white theme-dark:bg-[#0b0b0b]" />}>
  <HomeClient />
</Suspense>
```

### Client Component

**File:** `src/app/HomeClient.tsx`

Directive: `"use client"`

Manages the tab state via the `useActiveTab()` hook and composes the full page layout:

```tsx
<Navbar />
<div className="h-[72px] md:h-[56px]" />   {/* Spacer for fixed navbar */}
<TabNavigation />
<TabContainer activeTab={activeTab} />
<CommunityBanner />
<Footer />
```

| Import | Source | Purpose |
|--------|--------|---------|
| `Navbar` | `components/common/Navbar` | Fixed top navigation bar |
| `Footer` | `components/common/Footer` | Site footer |
| `TabNavigation` | `components/homepage/tabs/TabNavigation` | Tab switcher UI |
| `TabContainer` | `components/homepage/tabs/TabContainer` | Renders all four tab panels |
| `CommunityBanner` | `components/homepage/sections/CommunityBanner` | Community invite CTA (always visible below tabs) |
| `useActiveTab` | `hooks/useActiveTab` | Shared tab state hook returning `[activeTab, setActiveTab]` |

---

## Tab System

### TabNavigation

**File:** `src/app/components/homepage/tabs/TabNavigation.tsx`

Renders the tab switcher bar. The active tab is managed by the shared `useActiveTab()` hook (not passed as props — both `TabNavigation` and `HomeClient` consume the same hook).

#### Tab Configuration

```ts
type LandingTab = 'home' | 'recents' | 'hall-of-fame' | 'completed';

const TAB_ITEMS: TabConfig[] = [
  { id: 'home',         label: 'Home',         Icon: House },
  { id: 'recents',      label: 'Recents',      Icon: CalendarDots },
  { id: 'hall-of-fame', label: 'Hall of Fame',  Icon: Crown },
  { id: 'completed',    label: 'Completed',     Icon: PaperPlaneTilt },
];
```

Icons are from `@phosphor-icons/react`. The `Completed` tab uses `PaperPlaneTilt` (not `BookOpen`).

#### Desktop Layout (md+)

- Horizontal row of pill buttons (`rounded-full`)
- Each button shows icon + text label
- Active tab: `bg-gray-200 text-gray-900` (light) / `bg-slate-700 text-white` (dark)
- Active icon uses `weight="fill"`, inactive uses `weight="regular"`
- Pending tab (switching): shows `CircleNotch` spinner icon instead of the tab icon

#### Mobile Layout (&lt;md)

- 4-column grid layout (`grid grid-cols-4`)
- Each cell: vertically stacked icon + label text
- Active indicator: colored dot below the icon
- Pending tab: `CircleNotch` spinner replacing the icon during transition
- 180ms debounce timeout before clearing the pending state

#### State

| State | Type | Purpose |
|-------|------|---------|
| `activeTab` | `LandingTab` | Currently active tab (from `useActiveTab` hook) |
| `pendingTab` | `LandingTab \| null` | Tab being switched to (for loading spinner) |

#### Accessibility

- `role="tablist"` on the container
- `role="tab"` + `aria-selected` on each button
- `aria-controls` linking to panel IDs

---

### TabContainer

**File:** `src/app/components/homepage/tabs/TabContainer.tsx`

```ts
interface TabContainerProps {
  activeTab: LandingTab;
}
```

**Key design decision:** All four tab panels are rendered simultaneously. The inactive panels are hidden with `style={{ display: active ? 'block' : 'none' }}`. This approach:

- **Preserves mounted state** — component state, scroll position, and fetched data are retained when switching tabs
- **Prevents refetching** — React Query caches remain warm, no re-mount triggers
- **Instant switching** — no loading delay when returning to a previously visited tab

```tsx
<TabPanel active={activeTab === 'home'} panelId="home-panel">
  <HomeTab />
</TabPanel>
<TabPanel active={activeTab === 'recents'} panelId="recents-panel">
  <RecentsTab />
</TabPanel>
<TabPanel active={activeTab === 'hall-of-fame'} panelId="hall-of-fame-panel">
  <HallOfFameTab />
</TabPanel>
<TabPanel active={activeTab === 'completed'} panelId="completed-panel">
  <CompletedTab />
</TabPanel>
```

Each `TabPanel` wraps children in a `div` with `role="tabpanel"` and `aria-hidden={!active}`.

---

## Home Tab

**File:** `src/app/components/homepage/tabs/HomeTab.tsx`

Composes six content sections in order:

```tsx
<BannerCarousel />
<EventBanner />
<TrendingSection />
<SignatureSection />
<CatalogueSections />
<RecentlyUpdated />
```

---

### 1. BannerCarousel

**File:** `src/app/components/homepage/sections/BannerCarousel.tsx`

A full-width hero carousel showcasing featured novels.

| Aspect | Details |
|--------|---------|
| **Data** | `useShowcases()` React Query hook |
| **Library** | Swiper.js with `Autoplay` module |
| **Slides** | Full-bleed showcase image, novel title, one-liner, genre tags, CTA button |
| **Theming** | Each slide uses a `color_palette` parsed from CMS data for per-slide gradient/text colors |
| **Responsive** | Different slide dimensions for mobile vs. desktop breakpoints |
| **Navigation** | Swiper pagination dots, auto-advances |

---

### 2. EventBanner

**File:** `src/app/components/homepage/sections/EventBanner.tsx`

A promotional banner for community events (typically Discord invites).

| Aspect | Details |
|--------|---------|
| **Data** | `useEventBanner()` React Query hook |
| **Rendering** | Conditionally rendered based on CMS status and date range fields |
| **Design** | Purple gradient background, "Join our Community" CTA, Discord icon |
| **Action** | Links to external Discord invite URL |

---

### 3. TrendingSection

**File:** `src/app/components/homepage/sections/TrendingSection.tsx`

Displays trending novels with a ranked list.

| Aspect | Details |
|--------|---------|
| **Data** | `useTrendingNovels()` React Query hook via `useQuery` + `queryKeys.trending` |
| **Types** | `TrendingEntry { id, rank, novel: TrendingNovelData }` |

#### Layout

- **#1 Featured Card:** Large square cover image with overlay information (title, one-liner, genre tags). Links to the novel detail page.
- **Remaining Ranked List:** Numbered items with rank numbers in Orbitron font, text shadows for depth. Each item shows cover thumbnail, title, genres.
- **SectionHeader:** "Trending" title with "See All" link to `/novels`
- **BookmarkButton:** Toggle on each item for adding to library

#### Skeleton Loading

`FeaturedCardSkeleton` + `RankedListSkeleton` shimmer placeholders while data loads.

---

### 4. SignatureSection

**File:** `src/app/components/homepage/sections/SignatureSection.tsx`

An auto-rotating featured novels showcase with animated transitions.

| Aspect | Details |
|--------|---------|
| **Data** | `useFeaturedNovels()` React Query hook |
| **Rotation** | Auto-advances every 20 seconds (`AUTO_ROTATE_MS = 20_000`) |
| **Animation** | Framer Motion `AnimatePresence` with directional slide transitions |
| **Theming** | Dynamic `ColorPalette` (light/dark variants with primary, secondary, background, text, accent) parsed from CMS `color_palette` field |
| **Gestures** | Swipe left/right on mobile (threshold: `SWIPE_THRESHOLD = 50` px) |
| **Navigation** | Manual navigation dots below the showcase |

#### Layout

- Showcase image (cover or showcase asset) on one side
- Novel info panel on the other: title, one-liner, genre tags, "Read Now" CTA
- Background and text colors driven by the current novel's color palette
- `SectionHeader` with "Genesis Signature" title
- `BookmarkButton` on each featured novel

---

### 5. CatalogueSections

**File:** `src/app/components/homepage/sections/CatalogueSections.tsx`

Dynamic, CMS-driven genre/category sections.

| Aspect | Details |
|--------|---------|
| **Data** | `useCatalogueSpread()` React Query hook |
| **Sections** | Array of CMS-configured sections (e.g., "Action Adventures", "Romance", "Fantasy") |
| **Sorting** | Sorted by a CMS-defined `position` field |
| **Layout** | Each section: `SectionHeader` (title + "See All" link) + `HorizontalScroll` containing `NovelCard` components |
| **Cards** | Standard `NovelCard` with 2:3 aspect ratio cover images |

---

### 6. RecentlyUpdated

**File:** `src/app/components/homepage/sections/RecentlyUpdated.tsx`

Shows recently updated chapters with a free/paid tab toggle.

| Aspect | Details |
|--------|---------|
| **Data (Free)** | `useRecentlyFreed()` React Query hook |
| **Data (Paid)** | `fetchRecentPaidChapters()` via `useQuery` |
| **Tab State** | `TabValue: 'free' \| 'paid'` local state |

#### Free Tab

- Recently freed chapters
- Each item: novel cover thumbnail, novel title, chapter number + title, relative timestamp (`formatRelativeTime`)
- Clicking navigates to `/viewer/{chapterId}`

#### Paid Tab

- Locked chapters available for purchase
- Each item: novel cover thumbnail, lock icon (`Lock` from lucide-react), chapter info, Helix cost display (100)
- Clicking triggers unlock flow via `ModalViewboxContext.openModal()`
- Requires authentication — shows `LoginModal` if user is not logged in

#### Types

```ts
interface ChapterWithNovel {
  id: string;
  chapter_title: string;
  chapter_number: number;
  date_published: string;
  isPaid: boolean;
  helixCost: number;
  novel: {
    id: string;
    novel_title: string;
    cover: string;
    abbreviation: string;
    color_palette?: string[] | null;
    has_subscription?: boolean;
  };
}

type TabValue = 'free' | 'paid';
```

#### Dependencies

- `useAuth()` — for authentication state
- `useToast()` — for feedback messages
- `useModalViewbox()` — for opening unlock/subscription modals
- `useWallet(userId)` — for Helix balance and unlock operations

---

## Recents Tab

**File:** `src/app/components/homepage/tabs/RecentsTab.tsx`

Displays novels organized by their release/update day of the week.

| Component | File | Purpose |
|-----------|------|---------|
| `DayOfWeekTabs` | `shared/DayOfWeekTabs.tsx` | Mon–Sun day picker, highlights current day by default |
| `SortFilterBar` | `shared/SortFilterBar.tsx` | Sort + genre filter controls |
| `NovelCardGrid` | `shared/NovelCardGrid.tsx` | Responsive grid of novel cards |

#### Data Flow

1. `useReleaseDays()` hook fetches all novels with their release day schedules
2. User selects a day via `DayOfWeekTabs` (defaults to current day)
3. Results are filtered client-side by the selected day
4. `SortFilterBar` applies additional sort (Popular / Newest / Oldest) and genre multi-select filters
5. `NovelCardGrid` renders the filtered novels

#### SortFilterBar Responsive Behavior

| Viewport | Sort Control | Filter Control |
|----------|-------------|----------------|
| Desktop (md+) | Radix `DropdownMenu` | Radix `DropdownMenu` with checkbox items |
| Mobile (&lt;md) | `BottomSheet` drawer | `BottomSheet` drawer with checkbox items |

---

## Hall of Fame Tab

**File:** `src/app/components/homepage/tabs/HallOfFameTab.tsx`

Displays the Singularity ranking — a voting system where each user has one vote to place on any novel.

| Aspect | Details |
|--------|---------|
| **Data** | `useSingularityRankings()` React Query hook |

#### Layout

**#1 Ranked Novel — HofFeaturedCard:**

**File:** `src/app/components/homepage/shared/HofFeaturedCard.tsx`

- Large featured card layout
- Novel cover image, title, singularity vote count
- `SingularityButton` for voting

**Remaining Novels — Responsive:**

| Viewport | Component | File |
|----------|-----------|------|
| Desktop (md+) | `HofRankedCard` | `shared/HofRankedCard.tsx` |
| Mobile (&lt;md) | `HofRankedListItem` | `shared/HofRankedListItem.tsx` |

- Desktop: Grid of cards with rank number, cover, title, singularity count
- Mobile: Vertical list items with rank, thumbnail, title, count

#### Interaction

- `SingularityButton` on each card opens `SingularityConfirmDialog` to place or move vote
- `SingularityConfirmDialog` (`shared/SingularityConfirmDialog.tsx`): Confirmation modal that warns the user their vote will move from the currently voted novel (if any) to the new target. Requires authentication.

---

## Completed Tab

**File:** `src/app/components/homepage/tabs/CompletedTab.tsx`

Displays novels that have been marked as completed (serialization finished).

| Aspect | Details |
|--------|---------|
| **Data** | `useCompletedNovels()` React Query hook |
| **Filtering** | `SortFilterBar` for sorting (Popular / Newest / Oldest) and genre multi-select filtering |
| **Display** | `NovelCardGrid` of completed novels |
| **Empty State** | Message shown when no completed novels match current filters |

---

## Shared Homepage Components

These components are used across multiple homepage tabs and sections.

### NovelCard

**File:** `src/app/components/homepage/shared/NovelCard.tsx`

A card representing a single novel, used in grids and horizontal scrolls.

```ts
interface NovelCardProps {
  novel: NovelCardData;      // Novel data object (id, abbreviation, novel_title, cover, etc.)
  imageUrl?: string;          // Pre-resolved image URL
  className?: string;         // Additional CSS classes
  titleClassName?: string;    // Additional CSS for title text
}
```

| Feature | Details |
|---------|---------|
| **Aspect Ratio** | 2:3 (`aspectRatio: '2/3'`) |
| **Image** | Next.js `Image` with `fill` + `object-cover`, responsive `sizes` attribute |
| **Hover** | Scale transform `group-hover:scale-[1.02]` with 300ms transition |
| **Title** | Below the image, `line-clamp-2`, semibold |
| **Link** | Wraps entire card as `<Link href="/novels/{abbreviation}">` |
| **Fallback** | Pulse animation placeholder when `imageUrl` is not yet available |

---

### NovelCardGrid

**File:** `src/app/components/homepage/shared/NovelCardGrid.tsx`

```ts
interface NovelCardGridProps {
  novels: NovelCardData[];
  isLoading?: boolean;
  emptyMessage?: string;
}
```

| Feature | Details |
|---------|---------|
| **Layout** | Responsive CSS grid: 3 cols (mobile) → 4 cols (md) → 5 cols (lg+) |
| **Loading** | Shows skeleton card placeholders when `isLoading` is true |
| **Empty** | Displays `emptyMessage` when `novels` array is empty and not loading |

---

### SectionHeader

**File:** `src/app/components/homepage/shared/SectionHeader.tsx`

```ts
interface SectionHeaderProps {
  title: string;
  linkText?: string;
  linkHref?: string;
}
```

Renders a section title with an optional "See All" or custom CTA link aligned to the right.

---

### HorizontalScroll

**File:** `src/app/components/homepage/shared/HorizontalScroll.tsx`

A horizontal overflow scroll container for card carousels. Uses CSS `overflow-x: auto` with hidden scrollbar styling. Children are laid out in a flex row with gap spacing.

---

### BookmarkButton

**File:** `src/app/components/homepage/shared/BookmarkButton.tsx`

```ts
interface BookmarkButtonProps {
  novelId: string;
  onRequireAuth?: () => void;   // Callback when unauthenticated user clicks
  variant?: 'icon' | 'button';  // Display variant (default: 'icon')
  className?: string;
}
```

| Feature | Details |
|---------|---------|
| **Hook** | `useBookmarkToggle(novelId, { onRequireAuth })` — manages bookmark state and API calls |
| **Icon** | `BookmarkSimple` from `@phosphor-icons/react`, filled when active |
| **Toast Feedback** | Success: "Added to Library" / Warning: "Removed from Library" / Error: "Bookmark Failed" |
| **Auth Guard** | If user is not authenticated, calls `onRequireAuth` and shows warning toast |
| **Button Variant** | Full button with styled border, background colors differ for bookmarked/unbookmarked states |
| **Icon Variant** | Minimal icon-only button |

---

### SingularityButton

**File:** `src/app/components/homepage/shared/SingularityButton.tsx`

```ts
interface SingularityButtonProps {
  count: number;
  isActive?: boolean;     // Whether the user's singularity is on this novel
  isLoading?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';    // Size variant (default: 'sm')
  className?: string;
}
```

| Feature | Details |
|---------|---------|
| **Icon** | Custom SVG mask (`/icons/singularity.svg`) with CSS mask property |
| **Active State** | Violet border and background tint when the user's vote is on this novel |
| **Count** | Formatted with `formatCount()` utility, tabular-nums font |
| **Sizes** | `sm`: 24x24 icon, xs count text. `md`: 28x28 icon, sm count text |

---

### SingularityConfirmDialog

**File:** `src/app/components/homepage/shared/SingularityConfirmDialog.tsx`

Confirmation dialog shown when a user places or moves their singularity vote. Warns that:
- The user has only one singularity vote
- Moving the vote will remove it from the previously voted novel
- Displays both the source and target novel names

---

### BottomSheet

**File:** `src/app/components/homepage/shared/BottomSheet.tsx`

```ts
interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}
```

| Feature | Details |
|---------|---------|
| **Animation** | Framer Motion `AnimatePresence` with spring transition (`damping: 28, stiffness: 320`) |
| **Direction** | Slides up from bottom (`initial: { y: '100%' }`) |
| **Backdrop** | Semi-transparent black overlay (`bg-black/50`), clicking closes the sheet |
| **Keyboard** | Escape key closes the sheet |
| **Body Lock** | Sets `document.body.style.overflow = 'hidden'` while open |
| **Max Height** | `max-h-[55vh]` with internal scrolling |
| **Handle** | Drag handle bar at the top (`h-1.5 w-12 rounded-full`) |
| **Z-Index** | Backdrop: `z-[10001]`, Sheet: `z-[10002]` |

---

### DayOfWeekTabs

**File:** `src/app/components/homepage/shared/DayOfWeekTabs.tsx`

A horizontal row of day-of-week buttons (Mon–Sun). Used by the Recents tab. Defaults to the current day highlighted.

---

### SortFilterBar

**File:** `src/app/components/homepage/shared/SortFilterBar.tsx`

Combined sort and filter controls used across multiple tabs.

| Viewport | Rendering |
|----------|-----------|
| Desktop (md+) | Radix UI `DropdownMenu` components for both sort and genre filter |
| Mobile (&lt;md) | `BottomSheet` drawers for both sort and genre filter |

**Sort Options:** Popular, Newest, Oldest
**Filter:** Genre multi-select from available genres data

---

### ChapterListItem / ChapterListSection

**Files:** `src/app/components/homepage/ChapterListItem.tsx`, `src/app/components/homepage/ChapterListSection.tsx`

Chapter list components used by the `RecentlyUpdated` section. `ChapterListItem` renders a single chapter row with cover thumbnail, chapter info, and timestamp. `ChapterListSection` groups items under a section header.

---

## Loading States

Each major section has a dedicated skeleton loader that matches the layout of the loaded content:

| Skeleton | Used In | Description |
|----------|---------|-------------|
| `HeroSkeleton` | `BannerCarousel` | Full-width shimmer matching carousel dimensions |
| `FeaturedSkeleton` | `SignatureSection` | Shimmer for the featured novel showcase layout |
| `TrendingSkeleton` (inline) | `TrendingSection` | `FeaturedCardSkeleton` + `RankedListSkeleton` for the ranked list |
| `RecentSkeleton` (inline) | `RecentlyUpdated` | `ChapterCardSkeleton` rows for the chapter list |

All skeletons use the shared `<Skeleton>` component from `@/components/ui/skeleton` which renders a shimmer animation with appropriate dark mode colors.

---

## Cross-References

- **[08 — State Management](./08-State-Management.md):** React Query hooks (`useShowcases`, `useTrendingNovels`, `useFeaturedNovels`, `useCatalogueSpread`, `useRecentlyFreed`, `useSingularityRankings`, `useCompletedNovels`, `useReleaseDays`), context providers (`AuthContext`, `ToastContext`, `ModalViewboxContext`), and local state patterns.
- **[04 — API Reference](./04-API-Reference.md):** Singularity rankings endpoint, recent chapter APIs, and homepage data sources.
- **[06 — Payment & Subscription System](./06-Payment-Subscription-System.md):** `ModalViewboxContext` and unlock/subscription flows triggered from the paid recent-chapters UI.
