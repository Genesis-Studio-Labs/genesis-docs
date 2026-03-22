---
id: "10-UI-Novels-Listing"
slug: "/10-UI-Novels-Listing"
sidebar_position: 10
sidebar_label: "UI: Novels Listing"
---

# 10 — UI: Novels Listing Page

> The novels listing page provides a browsable, filterable grid of all published novels on the platform. It supports sorting by date or popularity, filtering by serialization status, and responsive layouts from 2 columns on mobile to 6 columns on extra-large screens.

---

## Table of Contents

- [Page Structure](#page-structure)
- [Data Fetching](#data-fetching)
- [Filtering and Sorting](#filtering-and-sorting)
- [Components](#components)
- [Responsive Layout](#responsive-layout)
- [Loading States](#loading-states)
- [SEO](#seo)
- [Cross-References](#cross-references)

---

## Page Structure

**Route:** `/novels`

**File:** `src/app/novels/page.tsx`

Directive: `"use client"`

This is a client component that composes the full novels listing page:

```tsx
<Navigation />
{/* Filter controls */}
{/* Novel grid */}
<Footer />
```

| Import | Source | Purpose |
|--------|--------|---------|
| `Navigation` | `components/common/Navbar` | Fixed top navigation bar |
| `Footer` | `components/common/Footer` | Site footer |
| `NovelGridSkeleton` | `components/skeletons/NovelGridSkeleton` | Loading state for the novel grid |
| `NovelsFilterSkeleton` | `components/skeletons/NovelsFilterSkeleton` | Loading state for the filter bar |
| `getAssetUrl`, `prefetchFileMetadata` | `lib/directus` | Image URL resolution and metadata prefetching |

---

## Data Fetching

### Novel Data

The page fetches all published novels on mount via a `useEffect`:

```ts
const response = await fetch('/api/directus/novels?status=published');
const novelsArray = (await response.json() as Novel[]) || [];
```

The API route proxies the request to Directus CMS with server-side authentication.

### Image Loading

After novels are fetched, all cover image IDs are extracted and processed:

1. `prefetchFileMetadata(coverIds)` — batch-fetches file metadata from Directus for all covers
2. `getAssetUrl(coverId, true, 'cover')` — constructs Cloudflare-optimized image URLs for each cover

Image URLs are stored in a `Record<string, string>` keyed by asset ID.

### Novel Interface

```ts
interface Novel {
  id: string;
  status: string;
  novel_title: string;
  synopsis: string;
  one_liner: string;
  cover: string;
  showcase: string;
  banner: string;
  square: string;
  year: number;
  author: string;
  abbreviation: string;
  rating: number | null;
  chapter_numbers: number;
  date_updated: string;
  last_updated: string;
  date_created: string;
  latest_free_chapter: number;
  latest_free_chapter_date: string | null;
  serialization: string;
  genres: Array<{ genres_id: number }>;
  total_views: number;
}
```

---

## Filtering and Sorting

All filtering and sorting is performed client-side using `useMemo` over the fetched novels array. No additional API calls are made when filters change.

### State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `sortField` | `'recent' \| 'views'` | `'recent'` | Sort by date or view count |
| `sortDirection` | `'asc' \| 'desc'` | `'desc'` | Sort order |
| `serializationFilter` | `string` | `'all'` | Filter by serialization status |

### Sort Options

| Sort Field | Direction | Description |
|-----------|-----------|-------------|
| `recent` | `desc` | Newest first (by `date_updated` or `last_updated`) |
| `recent` | `asc` | Oldest first |
| `views` | `desc` | Most popular (by `total_views`) |
| `views` | `asc` | Least popular |

### Status Filter

| Value | Description |
|-------|-------------|
| `all` | Show all published novels |
| `ongoing` | Only novels with `serialization === 'ongoing'` |
| `completed` | Only novels with `serialization === 'completed'` |

### Filter Pipeline

```
All Novels → Filter by serialization status → Sort by field + direction → Rendered grid
```

The filtering uses `useMemo` so the grid re-renders only when the novels array, sort, or filter state changes.

---

## Components

### Filter Controls

The page renders its own inline filter controls (not the shared `SortFilterBar`):

- **Sort Toggle:** Button with `ArrowUpDown` icon (lucide-react) that cycles through sort field and direction
- **Status Filter:** Button group or dropdown for All / Ongoing / Completed

### Novel Grid

The novels are rendered in a responsive CSS grid. Each cell is a card linking to the novel detail page:

```tsx
<Link href={`/novels/${novel.abbreviation}`}>
  <Image src={imageUrls[novel.cover]} ... />
  <p>{novel.novel_title}</p>
</Link>
```

Cards use:
- 2:3 aspect ratio for cover images (via `aspectRatio: '2/3'`)
- `object-cover` for image fill
- Title text below the image, `line-clamp-2`
- Hover scale transform for interactive feedback

### Shared Component Reuse

While the novels page has its own grid implementation, it follows the same patterns as the homepage shared components:

| Pattern | Homepage Equivalent | Notes |
|---------|-------------------|-------|
| Card layout | `NovelCard` | Same 2:3 aspect ratio, hover scale, title below |
| Grid layout | `NovelCardGrid` | Same responsive column breakpoints |
| Image loading | Same `getAssetUrl` pipeline | Cloudflare CDN optimized |

---

## Responsive Layout

The novel grid adapts across breakpoints:

| Breakpoint | Columns | Card Size |
|-----------|---------|-----------|
| Default (mobile) | 2 | ~50% viewport width |
| `sm` (640px+) | 3 | ~33% |
| `md` (768px+) | 4 | ~25% |
| `lg` (1024px+) | 5 | ~20% |
| `xl` (1280px+) | 6 | ~16% |

The grid uses percentage-based padding that scales with the container (`px-[5%]` to `px-[12%]`), matching the homepage layout system.

---

## Loading States

### NovelGridSkeleton

**File:** `src/app/components/skeletons/NovelGridSkeleton.tsx`

Renders a grid of shimmer placeholder cards matching the responsive column layout. Each skeleton card has:
- A 2:3 aspect ratio rectangle (cover placeholder)
- A text line below (title placeholder)

### NovelsFilterSkeleton

**File:** `src/app/components/skeletons/NovelsFilterSkeleton.tsx`

Renders shimmer placeholders for the filter bar controls (sort button, filter dropdown).

### Loading Flow

```
1. Page mounts → loading = true
2. Fetch novels from API
3. loading = false, novels displayed with grid skeleton during image prefetch
4. Image URLs resolved → full cards rendered
```

---

## SEO

### Metadata

Page metadata is set for search engine indexing:
- Title: includes "Novels" and "Genesis Studio"
- Description: describes the novel catalogue

### Sitemap

Published novels are included in `sitemap-novels.xml`, generated at build time from the CMS. Each novel gets an entry with:
- URL: `/novels/{abbreviation}`
- Last modified: `date_updated` from CMS
- Priority and change frequency values

---

## Cross-References

- **[08 — State Management](./08-State-Management.md):** Image pipeline utilities (`getAssetUrl`, `prefetchFileMetadata`), query client configuration.
- **[09 — UI: Homepage](./09-UI-Homepage.md):** Shared component patterns (`NovelCard`, `NovelCardGrid`, `SortFilterBar`) and design conventions.
- **[11 — UI: Novel Detail](./11-UI-Novel-Detail.md):** The detail page each novel card links to (`/novels/[abv]`).
