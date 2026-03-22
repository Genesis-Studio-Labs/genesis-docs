---
id: "07-Image-Pipeline"
slug: "/07-Image-Pipeline"
sidebar_position: 7
sidebar_label: "Image Pipeline"
---

# 07 — Image Pipeline

> Multi-step image delivery from Directus CMS through Supabase Storage to Cloudflare CDN with automatic format optimization.

---

## Table of Contents

- [Architecture](#architecture)
- [Step 1: Directus File Metadata](#step-1-directus-file-metadata)
- [Step 2: Supabase Storage URL](#step-2-supabase-storage-url)
- [Step 3: Cloudflare Image Transforms](#step-3-cloudflare-image-transforms)
- [Key Functions](#key-functions)
- [Caching Architecture](#caching-architecture)
- [Next.js Image Component](#nextjs-image-component)
- [Image Preloading](#image-preloading)
- [Color Extraction](#color-extraction)
- [Cross-References](#cross-references)

---

## Architecture

Images flow through a multi-step pipeline before reaching the browser:

```
Directus CMS          Supabase Storage         Cloudflare CDN           Browser
(UUID metadata)  -->  (actual file hosting) --> (format transforms) --> (rendered)
```

| Step | System | Role |
|------|--------|------|
| 1 | Directus | Stores file metadata as UUID references |
| 2 | Supabase Storage | Hosts the actual image files in a `directus` bucket |
| 3 | Cloudflare CDN | Applies optional image transformations (AVIF/WebP conversion) |

This separation allows CMS content to reference images by stable UUIDs while the actual file delivery is handled by optimized storage and CDN infrastructure.

---

## Step 1: Directus File Metadata

### How Images Are Referenced

Images in the CMS are stored as **UUID references**. For example, a novel's cover field might contain:

```
novel.cover = "abc-123-def-456-uuid"
```

This UUID maps to a file metadata record in Directus.

### DirectusFileMetadata Interface

```ts
interface DirectusFileMetadata {
  id: string;              // UUID
  storage: string;         // Storage adapter name
  filename_disk: string;   // Actual filename on disk (e.g., "abc123.jpg")
  filename_download: string; // Suggested download filename
  title: string;           // Display title
  type: string;            // MIME type (e.g., "image/jpeg")
  filesize: number;        // File size in bytes
  width: number;           // Image width in pixels
  height: number;          // Image height in pixels
  uploaded_on: string;     // Upload timestamp
}
```

### Proxy Route

**Endpoint:** `/api/directus-file/[id]`

This API route fetches file metadata from Directus:

```
GET /api/directus-file/{assetId}
  → Fetches /files/{id} from Directus API with Bearer token
  → Returns DirectusFileMetadata JSON
```

#### Route Features

| Feature | Implementation |
|---------|---------------|
| **In-memory cache** | 5-minute TTL — avoids repeated Directus API calls for the same file |
| **Request deduplication** | `pendingFileMetadataRequests` Map — concurrent requests for the same asset share a single in-flight fetch |
| **Concurrency limiting** | Controls the number of simultaneous outbound requests to Directus |
| **Timeout** | 15-second timeout via `AbortController` — prevents hung requests |
| **Failed request cooldown** | Failed fetches are cached for 5 minutes — avoids hammering Directus for consistently failing assets |

---

## Step 2: Supabase Storage URL

Once the `filename_disk` is known from the metadata, the actual file URL is constructed:

```
{NEXT_PUBLIC_SUPABASE_STORAGE_API}/directus/{filename_disk}
```

### Example

```
https://api.genesistudio.com/storage/v1/object/public/directus/abc123.jpg
```

### Configuration

The `NEXT_PUBLIC_SUPABASE_STORAGE_API` environment variable points to the Supabase Storage public URL. All files reside in the `directus` bucket, which is configured for public read access.

---

## Step 3: Cloudflare Image Transforms

### Enabling Transforms

Cloudflare image transformations are **optional** and controlled by an environment variable:

```
NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMS=true
```

When disabled, the raw Supabase Storage URL is used directly.

### URL Pattern

When enabled, image URLs are rewritten to pass through Cloudflare's image transform endpoint:

```
{NEXT_PUBLIC_BASE_SITE_URL}/cdn-cgi/image/{params}/{supabaseUrl}
```

### IMAGE_VARIANTS

Predefined transform presets for common use cases:

| Variant | Parameters | Use Case |
|---------|------------|----------|
| `thumbnail` | `format=avif,quality=90` | Small preview images |
| `cover` | `width=400,height=600,fit=cover,format=avif,quality=85` | Novel cover art |
| `banner` | `format=avif,quality=90` | Banner images |
| `hero` | `format=avif,quality=90` | Hero section images |
| `square` | `format=avif,quality=90` | Square aspect ratio images |
| `full` | `format=avif,quality=90` | Full-size images |

### Format Negotiation

Cloudflare automatically negotiates the best format based on the browser's `Accept` header:

```
AVIF (preferred) → WebP (fallback) → JPEG (final fallback)
```

This means even when `format=avif` is specified, browsers that don't support AVIF will receive WebP or JPEG automatically.

---

## Key Functions

**File:** `src/lib/directus.ts`

### getAssetUrl

```ts
async function getAssetUrl(
  assetId: string,
  useTransform?: boolean,
  variant?: string,
  baseUrl?: string
): Promise<string>
```

The **primary function** for resolving image URLs. Performs the full pipeline:

1. Fetches metadata from Directus (or cache).
2. Constructs the Supabase Storage URL using `filename_disk`.
3. Optionally applies Cloudflare image transforms.
4. Returns the final URL string, or an **empty string** if the asset is not found.

### getAssetUrlSync

```ts
function getAssetUrlSync(assetId: string): string
```

**Synchronous cache-only** version. Returns the URL immediately if the metadata is already cached, or an empty string if it's not. Useful for rendering contexts where async resolution isn't possible.

### prefetchFileMetadata

```ts
async function prefetchFileMetadata(assetIds: string[]): Promise<void>
```

**Batch parallel prefetch** for multiple asset IDs. Filters out IDs that are:

- Already cached (no need to refetch).
- Recently failed (within the 5-minute cooldown window).

Remaining IDs are fetched in parallel. Used when a page knows it will need multiple images (e.g., novel listings, showcase carousels).

### getTransformedImageUrl

```ts
function getTransformedImageUrl(imageUrl: string, variant: string): string
```

Applies the Cloudflare transform URL pattern to **any image URL**. Does not fetch metadata — assumes the input URL is already a valid image URL.

### transformSupabaseImageUrl

```ts
function transformSupabaseImageUrl(supabaseUrl: string, variant: string): string
```

Applies Cloudflare transforms specifically to **direct Supabase Storage URLs** (e.g., user profile pictures that bypass the Directus metadata step).

---

## Caching Architecture

Four caching layers prevent redundant network requests:

### fileMetadataCache

```ts
const fileMetadataCache = new Map<string, DirectusFileMetadata>();
```

- **Purpose:** In-memory cache of file metadata keyed by asset ID.
- **TTL:** 5 minutes.
- **Scope:** Module-level, persists across renders but not page reloads.

### pendingFileMetadataRequests

```ts
const pendingFileMetadataRequests = new Map<string, Promise<DirectusFileMetadata>>();
```

- **Purpose:** Deduplicates concurrent requests for the same asset.
- **Behavior:** If a fetch for asset `abc-123` is already in flight, subsequent calls receive the same promise instead of issuing a new network request.
- **Lifetime:** Entries are removed once the promise resolves or rejects.

### failedFileMetadataCache

```ts
const failedFileMetadataCache = new Map<string, number>();
```

- **Purpose:** Records timestamps of failed fetch attempts.
- **Cooldown:** 5 minutes — prevents retrying a failing asset on every render.
- **Behavior:** `prefetchFileMetadata` and `getAssetUrl` check this cache before making requests.

### loggedAssetWarnings

```ts
const loggedAssetWarnings = new Set<string>();
```

- **Purpose:** Ensures each "asset not found" warning is logged to the console only once.
- **Behavior:** Prevents log spam when the same missing asset is referenced by multiple components.

---

## Next.js Image Component

### Allowed Image Domains

The `next.config.ts` file configures the Next.js Image component to accept images from the following sources:

```ts
// next.config.ts — images.remotePatterns
[
  {
    // Directus direct asset access
    hostname: "edit.genesistudio.com",
    pathname: "/assets/**",
  },
  {
    // Directus file access
    hostname: "edit.genesistudio.com",
    pathname: "/files/**",
  },
  {
    // Cloudflare image transforms
    hostname: "genesistudio.com",
    pathname: "/cdn-cgi/image/**",
  },
  {
    // Supabase Storage (direct)
    hostname: "ckiwecspopkpvhccpisf.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    // Supabase Storage (custom domain)
    hostname: "api.genesistudio.com",
    pathname: "/storage/v1/object/public/**",
  },
]
```

All image pipeline outputs resolve to one of these domains, ensuring the Next.js `<Image>` component can optimize them.

---

## Image Preloading

**File:** `src/hooks/useImagePreload.ts`

### useImagePreload

A **circular buffer preloader** designed for carousels and sequential image browsing:

| Feature | Description |
|---------|-------------|
| Configurable buffer size | Preload N images ahead/behind the current position |
| Priority levels | Control loading order for visible vs. upcoming images |
| AbortController | Cancel in-flight preloads when the user navigates away |
| LRU eviction | Evicts least-recently-used entries when the cache exceeds 100 images |

```ts
const { isPreloaded } = useImagePreload(imageUrls, {
  bufferSize: 3,
  priority: "high",
});
```

### useImageListPreload

A simpler **batch preloader** for static image lists (e.g., novel grids, genre sections):

```ts
useImageListPreload(imageUrls);
```

Preloads all provided URLs in parallel without the circular buffer logic.

---

## Color Extraction

### API Endpoint

**Endpoint:** `/api/extract-colors`

Uses the `node-vibrant` library to extract dominant colors from image URLs:

```
POST /api/extract-colors
Body: { imageUrl: string }
Response: { palette: { Vibrant, Muted, DarkVibrant, DarkMuted, LightVibrant, LightMuted } }
```

### Storage

Extracted color palettes are stored in the `novel.color_palette` field in the CMS. This avoids re-extracting colors on every page load.

### Parsing

**File:** `src/types/color-palette.ts`

```ts
function parseColorPalette(data: unknown): ColorPalette;

interface ColorPalette {
  light: {
    primary: string;
    secondary: string;
  };
  dark: {
    primary: string;
    secondary: string;
  };
}

interface ThemeColors {
  primary: string;
  secondary: string;
}
```

`parseColorPalette()` normalizes raw palette data into a structured `ColorPalette` object with light and dark theme variants.

### Usage

Extracted colors are used for:

- **Novel detail pages:** Dynamic background gradients and accent colors.
- **Showcase cards:** Themed card backgrounds that match the novel's cover art.
- **Reading mode:** Subtle color accents in the chapter viewer.

---

## Cross-References

- **[01 — Architecture Overview](./01-Architecture-Overview.md):** System-level architecture showing where the image pipeline fits.
- **[01 — Architecture Overview](./01-Architecture-Overview.md):** Infrastructure and deployment context for Supabase Storage and Cloudflare.
- **[03 — Directus CMS Integration](./03-Directus-CMS-Integration.md):** Directus file metadata and CMS-side asset management.
- **[17 — UI: Styling System](./17-UI-Styling-System.md):** Skeleton/image-loading patterns and responsive media presentation.
