---
id: "18-SEO-Metadata"
slug: "/18-SEO-Metadata"
sidebar_position: 18
sidebar_label: "SEO & Metadata"
---

# 18 — SEO & Metadata

> How Genesis Studio handles search engine optimization, social sharing, structured data, sitemaps, and analytics.

---

## Table of Contents

1. [Next.js Metadata API](#1-nextjs-metadata-api)
2. [Sitemaps](#2-sitemaps)
3. [Robots](#3-robots)
4. [Web App Manifest](#4-web-app-manifest)
5. [Open Graph & Social](#5-open-graph--social)
6. [Structured Data (JSON-LD)](#6-structured-data-json-ld)
7. [Favicons & Icons](#7-favicons--icons)
8. [Analytics](#8-analytics)
9. [Cross-References](#9-cross-references)

---

## 1. Next.js Metadata API

Genesis Studio uses the Next.js App Router Metadata API to manage all `<head>` tags declaratively. Metadata is defined at the layout and page level and automatically merged by the framework.

### 1.1 Root Layout (`src/app/layout.tsx`)

The root layout exports a `metadata` object that provides site-wide defaults. Every page inherits these values unless it explicitly overrides them.

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Genesis Studio - Original Novels & Stories",
    template: "%s | Genesis Studio",
  },
  description:
    "Discover captivating original novels and stories on Genesis Studio. Read free chapters, unlock premium content with Helix, and subscribe to Luminary for unlimited access.",
  keywords: [
    "novels",
    "stories",
    "reading",
    "fiction",
    "original content",
    "genesis studio",
    "helix",
    "subscription",
  ],
  authors: [{ name: "Genesis Studio" }],
  creator: "Genesis Studio",
  publisher: "Genesis Studio",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://genesistudio.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://genesistudio.com",
    siteName: "Genesis Studio",
    title: "Genesis Studio - Original Novels & Stories",
    description:
      "Discover captivating original novels and stories on Genesis Studio.",
    images: [
      {
        url: "/images/genesis-og.svg",
        width: 1200,
        height: 630,
        alt: "Genesis Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};
```

**Key design decisions:**

| Setting | Value | Rationale |
|---------|-------|-----------|
| `title.template` | `"%s \| Genesis Studio"` | Child pages only set a short title; the brand name is appended automatically |
| `formatDetection` | All `false` | Prevents iOS Safari from auto-linking phone numbers and addresses in body text |
| `metadataBase` | `https://genesistudio.com` | Resolves all relative OG/image URLs to the production domain |
| `robots.googleBot` | Max previews enabled | Allows Google to show rich snippets, large image previews, and video previews |

### 1.2 Per-Page Metadata

Each route segment can export its own `metadata` constant (or a `generateMetadata` function for dynamic routes). The title template from the root layout wraps the page-level title automatically.

#### Static Pages

| Page | File | Title | Description |
|------|------|-------|-------------|
| About | `src/app/about/page.tsx` | `"About"` | Overview of the Genesis Studio team and mission |
| Privacy | `src/app/privacy/page.tsx` | `"Privacy Policy"` | Data collection and usage policies |
| Terms | `src/app/terms-of-service/page.tsx` | `"Terms of Service"` | Platform terms and conditions |
| Store | `src/app/store/page.tsx` | `"Store"` | Helix packs and Luminary subscription offerings |
| Library | `src/app/library/page.tsx` | `"Library"` | User's personal reading library |

Each static page exports a plain `metadata` object:

```typescript
// src/app/about/page.tsx
export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Genesis Studio — our mission, team, and vision for original storytelling.",
};
```

The rendered `<title>` for the About page becomes: **About | Genesis Studio** (via the template).

#### Dynamic Pages — Novel Detail

The novel detail page (`src/app/novels/[abv]/page.tsx`) uses `generateMetadata` to produce per-novel SEO tags at request time:

```typescript
export async function generateMetadata({
  params,
}: {
  params: { abv: string };
}): Promise<Metadata> {
  const novel = await fetchNovelByAbbreviation(params.abv);

  if (!novel) {
    return { title: "Novel Not Found" };
  }

  return {
    title: novel.title,
    description: novel.synopsis?.slice(0, 160) ?? "Read on Genesis Studio.",
    openGraph: {
      title: novel.title,
      description: novel.synopsis?.slice(0, 160),
      type: "book",
      url: `/novels/${novel.abbreviation}`,
    },
  };
}
```

This ensures that when a novel page is shared on social media, the link preview shows the novel's actual title and synopsis.

---

## 2. Sitemaps

Genesis Studio uses a **sitemap index** strategy to split the sitemap into logical groups, keeping each sub-sitemap focused and easy for crawlers to process.

### 2.1 Sitemap Index (`src/app/sitemap.ts`)

The root sitemap file returns an array of sub-sitemap URLs. Next.js serves this at `/sitemap.xml`.

```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://genesistudio.com/sitemap-static.xml" },
    { url: "https://genesistudio.com/sitemap-novels.xml" },
    { url: "https://genesistudio.com/sitemap-chapters.xml" },
  ];
}
```

### 2.2 Static Sitemap (`src/app/sitemap-static.xml.ts`)

Contains all static marketing and utility pages.

```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://genesistudio.com";

  return [
    { url: baseUrl,                          changeFrequency: "daily",   priority: 1.0 },
    { url: `${baseUrl}/novels`,              changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}/store`,               changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}/library`,             changeFrequency: "weekly",  priority: 0.7 },
    { url: `${baseUrl}/about`,               changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`,             changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/terms-of-service`,    changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/announcements`,       changeFrequency: "weekly",  priority: 0.6 },
  ];
}
```

### 2.3 Novels Sitemap (`src/app/sitemap-novels.xml.ts`)

Dynamically generates entries for every published novel by querying Directus at build/request time.

```typescript
import type { MetadataRoute } from "next";
import { serverDirectus } from "@/lib/directus";
import { readItems } from "@directus/sdk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://genesistudio.com";

  const novels = await serverDirectus.request(
    readItems("novels", {
      fields: ["abbreviation", "date_updated"],
      filter: { status: { _eq: "published" } },
    })
  );

  return novels.map((novel) => ({
    url: `${baseUrl}/novels/${novel.abbreviation}`,
    lastModified: novel.date_updated
      ? new Date(novel.date_updated)
      : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}
```

### 2.4 Chapters Sitemap (`src/app/sitemap-chapters.xml.ts`)

Generates entries for all publicly accessible (free) chapters.

```typescript
import type { MetadataRoute } from "next";
import { serverDirectus } from "@/lib/directus";
import { readItems } from "@directus/sdk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://genesistudio.com";

  const chapters = await serverDirectus.request(
    readItems("chapters", {
      fields: ["id", "date_updated"],
      filter: {
        status: { _eq: "published" },
        access_level: { _in: ["public", "free"] },
      },
    })
  );

  return chapters.map((chapter) => ({
    url: `${baseUrl}/viewer/${chapter.id}`,
    lastModified: chapter.date_updated
      ? new Date(chapter.date_updated)
      : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
```

---

## 3. Robots (`src/app/robots.ts`) {#3-robots}

The robots configuration controls which paths crawlers may access and explicitly blocks AI training crawlers from scraping content.

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/*", "/auth/callback", "/payment/*"],
      },
      // Block AI training crawlers
      { userAgent: "GPTBot",         disallow: "/" },
      { userAgent: "CCBot",          disallow: "/" },
      { userAgent: "anthropic-ai",   disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "ChatGPT-User",   disallow: "/" },
      { userAgent: "Bytespider",     disallow: "/" },
      { userAgent: "ClaudeBot",      disallow: "/" },
    ],
    sitemap: "https://genesistudio.com/sitemap.xml",
  };
}
```

### Blocked Paths

| Path Pattern | Reason |
|--------------|--------|
| `/api/*` | API endpoints are not content pages |
| `/auth/callback` | Supabase auth callback — no indexable content |
| `/payment/*` | Payment processing routes — private |

### AI Crawler Blocking

Genesis Studio publishes original fiction. To protect authors' intellectual property, the following AI training crawlers are explicitly denied:

| Crawler | Operator |
|---------|----------|
| `GPTBot` | OpenAI |
| `CCBot` | Common Crawl |
| `anthropic-ai` | Anthropic |
| `Google-Extended` | Google AI training |
| `ChatGPT-User` | OpenAI (ChatGPT browsing) |
| `Bytespider` | ByteDance |
| `ClaudeBot` | Anthropic |

---

## 4. Web App Manifest (`src/app/manifest.ts`) {#4-web-app-manifest}

The manifest enables Progressive Web App (PWA) features — add-to-homescreen, splash screens, and standalone window mode.

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Genesis Studio",
    short_name: "Genesis",
    description:
      "Discover captivating original novels and stories. Read free chapters, unlock premium content with Helix, and subscribe for unlimited access.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0f",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

| Property | Value | Notes |
|----------|-------|-------|
| `display` | `"standalone"` | Hides the browser chrome when launched from homescreen |
| `orientation` | `"portrait-primary"` | Novel reading is a portrait-mode activity |
| `background_color` | `#0a0a0f` | Matches the dark-mode body background |
| `theme_color` | `#7c3aed` | Genesis Studio brand purple — colors the status bar on mobile |

---

## 5. Open Graph & Social

### 5.1 Default OG Image

The fallback Open Graph image is a branded SVG located at `/images/genesis-og.svg`. It is 1200×630 pixels — the recommended size for both Facebook and Twitter link previews.

This image is referenced in the root layout's `openGraph.images` array and is used whenever a page does not provide its own OG image.

### 5.2 Per-Novel Dynamic OG Images (`src/app/novels/[abv]/opengraph-image.tsx`)

Novel detail pages generate a unique Open Graph image at request time using Next.js `ImageResponse`. This means every novel shared on social media gets a rich, branded preview card.

```typescript
import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";
export const alt = "Novel cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { abv: string };
}) {
  // Create a standalone Directus client — no auth needed for public data
  const directus = createDirectus(process.env.NEXT_PUBLIC_DIRECTUS_URL!)
    .with(rest());

  const novels = await directus.request(
    readItems("novels", {
      filter: { abbreviation: { _eq: params.abv } },
      fields: ["title", "author", "cover_image", "genres"],
      limit: 1,
    })
  );

  const novel = novels[0];
  if (!novel) {
    return new ImageResponse(<div>Novel not found</div>, { ...size });
  }

  const coverUrl = novel.cover_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_API}/${novel.cover_image}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        {/* Cover image */}
        {coverUrl && (
          <img
            src={coverUrl}
            width={320}
            height={480}
            style={{ borderRadius: 12, objectFit: "cover" }}
          />
        )}

        {/* Text content */}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 48, justifyContent: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#ffffff" }}>
            {novel.title}
          </div>
          <div style={{ fontSize: 24, color: "#a78bfa", marginTop: 12 }}>
            by {novel.author}
          </div>

          {/* Genre tags */}
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            {(novel.genres ?? []).slice(0, 3).map((genre: string) => (
              <span
                key={genre}
                style={{
                  background: "rgba(124, 58, 237, 0.3)",
                  color: "#c4b5fd",
                  padding: "6px 16px",
                  borderRadius: 20,
                  fontSize: 16,
                }}
              >
                {genre}
              </span>
            ))}
          </div>

          {/* Branding */}
          <div style={{ fontSize: 20, color: "#6b7280", marginTop: "auto" }}>
            Genesis Studio
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**Architecture notes:**

- A standalone Directus client is created inside the OG image handler — it does not reuse the auth-enabled server client because OG generation runs on the edge and only reads public data.
- The cover image URL is constructed from `NEXT_PUBLIC_SUPABASE_STORAGE_API` to match the image pipeline used by the rest of the app (see [doc 07 — Image Pipeline](./07-Image-Pipeline.md)).

### 5.3 Twitter Card

The root layout sets `twitter.card` to `"summary_large_image"`, which instructs Twitter/X to render a large image preview when a Genesis Studio link is shared.

---

## 6. Structured Data (JSON-LD)

The root layout injects an Organization schema into every page as a `<script type="application/ld+json">` tag. This helps Google associate the site with the Genesis Studio brand in search results.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Genesis Studio",
  "url": "https://genesistudio.com",
  "logo": "https://genesistudio.com/images/genesis-og.svg",
  "description": "Genesis Studio is a platform for discovering and reading original novels and stories. Explore a growing library of fiction across multiple genres.",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Service",
    "url": "https://genesistudio.com/about"
  }
}
```

This is embedded in `src/app/layout.tsx`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Genesis Studio",
      url: "https://genesistudio.com",
      logo: "https://genesistudio.com/images/genesis-og.svg",
      description:
        "Genesis Studio is a platform for discovering and reading original novels and stories. Explore a growing library of fiction across multiple genres.",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "Customer Service",
        url: "https://genesistudio.com/about",
      },
    }),
  }}
/>
```

---

## 7. Favicons & Icons

Genesis Studio provides favicons in multiple formats to support all browsers and devices.

| File | Path | Size | Purpose |
|------|------|------|---------|
| `favicon.ico` | `/favicon.ico` | Multi-size | Legacy ICO format for older browsers |
| `icon.svg` | `/icon.svg` (`src/app/icon.svg`) | Scalable | SVG favicon for modern browsers — scales perfectly at any size |
| `apple-touch-icon.png` | `/apple-touch-icon.png` | 180×180 | Homescreen icon on iOS/iPadOS |
| `favicon-16x16.png` | `/favicon-16x16.png` | 16×16 | Small PNG for tab icons |
| `favicon-32x32.png` | `/favicon-32x32.png` | 32×32 | Standard PNG favicon |

Next.js automatically discovers `icon.svg` and `apple-touch-icon.png` inside `src/app/` and generates the corresponding `<link>` tags in the HTML head.

---

## 8. Analytics

### 8.1 Vercel Analytics

Genesis Studio uses Vercel's built-in analytics services for performance monitoring and page-view tracking.

```tsx
// src/app/layout.tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

| Component | Package | What It Tracks |
|-----------|---------|----------------|
| `<Analytics />` | `@vercel/analytics/react` | Page views, unique visitors, referrers, top pages. Data visible in the Vercel dashboard → Analytics tab. |
| `<SpeedInsights />` | `@vercel/speed-insights/next` | Core Web Vitals (LCP, FID, CLS), TTFB, and FCP. Data visible in Vercel dashboard → Speed Insights tab. |

Both components are zero-config — they activate automatically when deployed to Vercel. During local development they are inert (no data is sent).

### 8.2 Custom Analytics Events (`src/lib/analytics.ts`)

The app tracks domain-specific events (e.g., novel opened, chapter read, purchase completed) through a custom analytics utility. These events are fired at key interaction points throughout the application.

```typescript
// src/lib/analytics.ts
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  // Vercel Analytics custom events
  if (typeof window !== "undefined" && window.va) {
    window.va("event", { name: eventName, ...properties });
  }
}
```

Example usage:

```typescript
trackEvent("novel_opened", { abbreviation: "TBOS", title: "The Book of Shadows" });
trackEvent("chapter_read",  { chapterId: 42, readTime: 312 });
trackEvent("helix_purchase", { packId: "starter", amount: 499 });
```

---

## 9. Cross-References

| Topic | Document |
|-------|----------|
| Architecture & environment variables | [01 — Architecture Overview](./01-Architecture-Overview.md) |
| Novel detail page (consumes per-novel metadata) | [11 — UI: Novel Detail](./11-UI-Novel-Detail.md) |
| Image pipeline (cover images used in OG) | [07 — Image Pipeline](./07-Image-Pipeline.md) |
| Directus CMS integration (data source for sitemaps) | [03 — Directus CMS Integration](./03-Directus-CMS-Integration.md) |
