---
id: "17-UI-Styling-System"
slug: "/17-UI-Styling-System"
sidebar_position: 17
sidebar_label: "UI: Styling System"
---

# 17 — UI: Styling System

> Tailwind CSS 4 with inline theme configuration, class-based dark mode, extensive custom CSS for chapter typography, GPU-accelerated animations, and a consistent skeleton loading system.

---

## Table of Contents

- [Tailwind CSS 4 Setup](#tailwind-css-4-setup)
- [Global CSS](#global-css)
- [Dark Mode System](#dark-mode-system)
- [Custom CSS Sections](#custom-css-sections)
- [Responsive Design Patterns](#responsive-design-patterns)
- [Component Libraries](#component-libraries)
- [Icon Systems](#icon-systems)
- [Skeleton Loading System](#skeleton-loading-system)
- [Utility: cn()](#utility-cn)
- [Cross-References](#cross-references)

---

## Tailwind CSS 4 Setup

Genesis Studio uses **Tailwind CSS 4**, which differs significantly from v3 in configuration approach.

### PostCSS Configuration

**File:** `postcss.config.mjs`

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

Tailwind v4 uses the `@tailwindcss/postcss` plugin directly — there is **no traditional `tailwind.config.js` file**. All theme configuration is done inline in CSS via the `@theme` directive.

### Additional Packages

| Package | Purpose |
|---------|---------|
| `tw-animate-css` | Animation utility classes for Tailwind |

### Path Alias

Configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

All imports use `@/` to reference the `src/` directory.

---

## Global CSS

**File:** `src/app/globals.css` (~1161 lines)

This is the central stylesheet for the entire application. It contains the Tailwind theme configuration, brand tokens, dark mode overrides, custom component styles, and keyframe animations.

### @theme Configuration Block

Replaces the traditional `tailwind.config.js`. Defines all custom design tokens:

#### Custom Fonts

```css
@theme {
  --font-geist-sans: /* Geist Sans font stack */;
  --font-geist-mono: /* Geist Mono font stack */;
  --font-orbitron: /* Orbitron font stack */;
}
```

#### Color Tokens (oklch)

shadcn/ui theming uses oklch color space for perceptual uniformity:

| Token | Purpose |
|-------|---------|
| `--background` | Page background |
| `--foreground` | Primary text color |
| `--card` | Card surface background |
| `--primary` | Primary action color |
| `--secondary` | Secondary action color |
| `--muted` | Subdued backgrounds |
| `--accent` | Accent highlights |
| `--destructive` | Error/danger color |
| `--border` | Border color |
| `--input` | Form input border |
| `--ring` | Focus ring color |
| `--sidebar-*` | Sidebar-specific tokens |

#### Brand Colors

```css
--accent-cyan: #22D3EE;
--accent-cyan-light: /* lighter variant */;
--accent-cyan-dark: /* darker variant */;
```

The accent cyan (`#22D3EE`) is the primary brand color used for active states, CTAs, links, and highlights throughout the application.

#### Border Radius

```css
--radius: 0.625rem;
```

Base radius value used by shadcn/ui components with `rounded-*` utilities.

---

## Dark Mode System

### Implementation: Class-Based

Genesis Studio does **not** use Tailwind's native `dark:` modifier. Instead, dark mode is implemented via CSS classes applied to the `<html>` element:

| Class | Mode |
|-------|------|
| `.theme-dark` | Dark mode active |
| `.theme-light` | Light mode active |

### ThemeProvider

**File:** `src/app/components/common/ThemeProvider.tsx`

- `applyThemeClass()` utility adds/removes the appropriate class on `<html>`
- Called by the Navbar's theme toggle button (Sun/Moon icons)
- Persists the user's preference to `localStorage`

### CSS Implementation

In `globals.css`, dark mode is applied through extensive `.theme-dark` selector overrides:

```css
.theme-dark {
  /* Overrides use !important to ensure specificity */
  --background: /* dark oklch value */ !important;
  --foreground: /* light text oklch value */ !important;
  /* ... */
}
```

The `!important` declarations are necessary because the class-based approach requires overriding the default light theme values set in `@theme`.

### useDarkMode Hook

A custom hook that reactively tracks the current theme:

```ts
function useDarkMode(): { isDarkMode: boolean }
```

- Uses a `MutationObserver` watching the `<html>` element's `class` attribute
- Returns `{ isDarkMode: true }` when `.theme-dark` is present
- Components can use this for conditional rendering:

```tsx
const { isDarkMode } = useDarkMode();
return <div className={isDarkMode ? 'bg-gray-900' : 'bg-white'} />;
```

### Why Not `dark:` Modifier?

The class-based approach was chosen for:
1. Compatibility with the shadcn/ui oklch token system
2. Fine-grained control over transition behavior
3. The ability to use `!important` overrides where needed
4. Consistent behavior with server-rendered content

---

## Custom CSS Sections

The `globals.css` file contains several distinct custom CSS sections beyond the Tailwind theme:

### a. 8-Point Grid Utilities

```css
.spacing-8  { /* 8px spacing */ }
.spacing-16 { /* 16px spacing */ }
.spacing-24 { /* 24px spacing */ }
.spacing-32 { /* 32px spacing */ }
```

Utility classes enforcing an 8-point grid system for consistent spacing.

### b. Custom Scrollbar

```css
/* Thin scrollbar with themed colors */
::-webkit-scrollbar { width: thin; }
::-webkit-scrollbar-thumb { /* themed thumb color */ }
::-webkit-scrollbar-track { /* themed track color */ }
/* smooth scroll behavior */
html { scroll-behavior: smooth; }
```

Applies to all scrollable containers. Thumb and track colors adapt to the active theme.

### c. Chapter Viewer Typography

The `.chapter-content-html` class contains extensive typography rules for the novel reader view. This is one of the largest and most complex sections.

#### Colored Text Classes

| Class | Color | Effect |
|-------|-------|--------|
| `.red-text` | Red | Red text color + `text-shadow` glow |
| `.blue-text` | Blue | Blue text color + glow |
| `.gold-text` | Gold | Gold text color + glow |
| `.silver-text` | Silver | Silver text color + glow |

#### Colored Box Classes

| Class | Style |
|-------|-------|
| `.red-box` | Red border, red-tinted background |
| `.blue-box` | Blue border, blue-tinted background |
| `.gold-box` | Gold border, gold-tinted background |
| `.silver-box` | Silver border, silver-tinted background |

These boxes are bordered containers used for in-chapter callouts, system messages, and special text blocks.

#### Title Separators

`h2` and `h3` elements within `.chapter-content-html` have `::after` pseudo-elements that render gradient lines below the heading text, creating visual section breaks.

#### Game Prompt Styles

`.game-prompt-silver-info` and similar classes render game-like notification boxes — styled to resemble in-game system messages or status updates. Used in LitRPG and GameLit novel content.

#### Special Formatting

- Dialogue formatting styles
- Narration emphasis styles
- Internal monologue styles (typically italicized with distinct coloring)

#### Custom Fonts

Imported via `@import` for chapter content:

| Font | Usage |
|------|-------|
| Quattrocento | Serif body text alternative |
| Amita | Decorative/fantasy headers |
| MedievalSharp | Fantasy/medieval themed content |
| Open Sans | Clean sans-serif body text |
| PT Serif | Serif body text |
| Arbutus Slab | Slab serif for emphasis |
| Roboto | UI-adjacent text within chapters |

### d. GPU Acceleration Utilities

```css
.gpu-accelerated { will-change: transform; }
.gpu-transform   { transform: translateZ(0); }
.gpu-opacity     { will-change: opacity; }
```

Applied to elements that animate frequently (carousels, modals, scroll-driven animations) to promote them to their own compositor layer.

### e. Keyframe Animations

| Animation | Purpose | Description |
|-----------|---------|-------------|
| `sheen` | Button hover | Horizontal sweep highlight across button surface |
| `gradientShift` | CTA buttons | Animated gradient position shift for eye-catching CTAs |
| `pulse` | Emphasis | Scale + box-shadow breathing effect |
| `slide-in-right` | Toast entry | Slides element in from the right edge |
| `slide-out-right` | Toast exit | Slides element out to the right edge |
| `shrink-width` | Toast timer | Width shrinks from 100% to 0% (progress bar countdown) |

### f. HIG-Inspired Surfaces

```css
.hig-surface    { /* Frosted glass: backdrop-blur, semi-transparent bg */ }
.hig-pill       { /* Rounded pill-shaped buttons */ }
.hig-focus-ring { /* Visible focus indicator ring */ }
```

Apple Human Interface Guidelines–inspired surface treatments used for the Navbar, modals, and interactive elements.

### g. Line Clamp

```css
.line-clamp-1 { /* Single line truncation with ellipsis */ }
.line-clamp-2 { /* Two line truncation */ }
.line-clamp-3 { /* Three line truncation */ }
```

Text truncation utilities using `-webkit-line-clamp`.

### h. Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Respects the user's OS-level motion preference by effectively disabling all animations.

### i. Trending Section

Custom styles for the trending novels section:

- Orbitron font applied to rank numbers
- Text shadows for depth on rank digits
- Custom scrollbar for the horizontal trending scroll container

---

## Responsive Design Patterns

### Consistent Padding

A standardized padding scale is used across all page containers:

```
px-[5%] sm:px-[6%] md:px-[8%] lg:px-[10%] xl:px-[12%]
```

This creates proportional gutters that grow with viewport width.

### Max Content Width

```
max-w-[1440px] mx-auto
```

Content is capped at 1440px and centered. Beyond this width, the background fills but content stays constrained.

### Mobile/Desktop Layout Pattern

Complex pages use explicit layout branches rather than pure responsive modifiers:

```tsx
{/* Mobile layout */}
<div className="lg:hidden">
  {/* Mobile-specific component tree */}
</div>

{/* Desktop layout */}
<div className="hidden lg:block">
  {/* Desktop-specific component tree */}
</div>
```

This pattern is used when mobile and desktop layouts differ structurally (not just in styling).

### Navbar Spacer

Pages include a spacer div to prevent content from rendering behind the fixed Navbar:

```
h-[72px] md:h-[56px]
```

The Navbar is taller on mobile (72px) than desktop (56px).

### Breakpoints

Standard Tailwind breakpoints are used:

| Breakpoint | Min Width |
|------------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

---

## Component Libraries

### shadcn/ui

| Aspect | Detail |
|--------|--------|
| **Style** | New York |
| **RSC** | Enabled (React Server Components compatible) |
| **Config** | `components.json` at project root |
| **Component path** | `src/components/ui/` |

**Currently installed components:**

| Component | File | Radix Dependency |
|-----------|------|-----------------|
| Skeleton | `skeleton.tsx` | None |
| DropdownMenu | `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` |

**Additional Radix packages:**

| Package | Usage |
|---------|-------|
| `@radix-ui/react-slot` | Polymorphic component composition |
| `@radix-ui/react-dialog` | Modal/dialog primitives |
| `class-variance-authority` | Variant-based class management |

### Framer Motion

| Aspect | Detail |
|--------|--------|
| **Wrapper** | `LazyMotion` with `domAnimation` features |
| **Bundle impact** | ~50KB savings via lazy loading |
| **Component syntax** | `m.div` (lazy) **not** `motion.div` |
| **Entry/Exit** | `AnimatePresence` for mount/unmount animations |
| **Transitions** | Spring-based for modals, drawers, Navbar |

### Swiper 12

| Aspect | Detail |
|--------|--------|
| **Usage** | `BannerCarousel` component only |
| **Module** | Autoplay |
| **Pagination** | Custom pagination dots |

---

## Icon Systems

Three icon libraries are used, each with a distinct role:

### Phosphor Icons (`@phosphor-icons/react`)

Used primarily for tab navigation and specialized UI elements:

| Icon | Usage |
|------|-------|
| `House` | Home tab |
| `CalendarDots` | Schedule/calendar contexts |
| `Crown` | Premium/ranking indicators |
| `BookOpen` | Reading/novel contexts |
| `PaperPlaneTilt` | Send/submit actions |
| `DiscordLogo` | Discord social link |
| `ChatCenteredDots` | Comments/chat |
| `Faders` | Filter controls |
| `SortAscending` | Sort indicators |
| `BookmarkSimple` | Bookmark toggle |

### Lucide React (`lucide-react`)

The **primary icon library** — used for most UI elements:

| Category | Icons |
|----------|-------|
| Navigation | `Search`, `Menu`, `X`, `ChevronLeft`, `ChevronRight`, `ArrowLeft` |
| Theme | `Sun`, `Moon` |
| Content | `Eye`, `Lock`, `Unlock`, `Star`, `Heart`, `BookOpen` |
| Actions | `Settings`, `LogOut`, `Plus`, `Minus` |

### React Icons (`react-icons`)

Minimal usage. Available as a fallback when Phosphor and Lucide don't have the needed icon. No primary usage patterns — imported on a case-by-case basis.

---

## Skeleton Loading System

**Directory:** `src/app/components/skeletons/`

A comprehensive set of loading placeholder components that match the exact layout dimensions of their content counterparts.

### Base Component

**File:** `src/components/ui/skeleton.tsx`

The shadcn/ui `Skeleton` component — a `div` with shimmer/pulse animation. All page-level skeletons are composed from this base.

### Page-Level Skeletons

| Skeleton | Matches | Description |
|----------|---------|-------------|
| `HeroSkeleton` | Homepage hero/banner | Large image placeholder + text blocks |
| `FeaturedSkeleton` | Featured novels section | Card grid with image + text placeholders |
| `TrendingSkeleton` | Trending section | Featured card placeholder + numbered list |
| `RecentSkeleton` | Recently updated section | Horizontal card row placeholders |
| `NovelGridSkeleton` | Novel browse grid | Responsive grid of card-shaped placeholders |
| `NovelsFilterSkeleton` | Filter/sort bar | Horizontal bar with button-shaped placeholders |
| `NovelDetailSkeleton` | Novel detail page | Separate mobile and desktop layout variants |
| `ChaptersSkeleton` | Chapter accordion | Stacked row placeholders |
| `ChapterViewerSkeleton` | Full-screen reader | Full-viewport text block placeholder |
| `NovelSubscriptionCardsSkeleton` | Store subscription cards | Grid of card-shaped placeholders |

### Loading Pattern

The standard loading pattern used throughout the application:

```tsx
const { data, isLoading } = useQuery({ queryKey: [...], queryFn: ... });

if (isLoading) return <PageSkeleton />;
return <PageContent data={data} />;
```

React Query's `isLoading` state drives the skeleton → content transition. Skeletons are dimensionally matched to their content counterparts to prevent layout shift during the transition.

---

## Utility: cn()

**File:** `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

The standard shadcn/ui pattern for conditional class merging:

- `clsx` handles conditional class logic (falsy values, arrays, objects)
- `tailwind-merge` resolves conflicting Tailwind classes (e.g., `p-4` + `p-2` → `p-2`)

Used throughout the codebase for composing dynamic class strings:

```tsx
<div className={cn('base-class', isActive && 'active-class', className)} />
```

---

## Cross-References

| Doc | Relevance |
|-----|-----------|
| [07 — Image Pipeline](./07-Image-Pipeline.md) | Cloudflare CDN image transforms, Next.js Image component usage |
| [09 — UI: Homepage](./09-UI-Homepage.md) | Homepage skeleton components, responsive patterns |
| [10 — UI: Novels Listing](./10-UI-Novels-Listing.md) | NovelGridSkeleton, NovelsFilterSkeleton usage |
| [11 — UI: Novel Detail](./11-UI-Novel-Detail.md) | NovelDetailSkeleton, chapter typography CSS |
| [12 — UI: Chapter Viewer](./12-UI-Chapter-Viewer.md) | ChapterViewerSkeleton, .chapter-content-html styles |
| [14 — UI: Store](./14-UI-Store.md) | NovelSubscriptionCardsSkeleton, store page styling |
| [15 — UI: Library](./15-UI-Library.md) | Library skeleton loading states |
| [16 — UI: Common Components](./16-UI-Common-Components.md) | Theme system, LazyMotionWrapper, Navbar, Toast animations |
