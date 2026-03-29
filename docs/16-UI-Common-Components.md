---
id: "16-UI-Common-Components"
slug: "/16-UI-Common-Components"
sidebar_position: 16
sidebar_label: "UI: Common Components"
---

# 16 — UI: Common Components

> Shared layout components, global providers, modals, and utilities that form the foundation of every page in Genesis Studio.

---

## Table of Contents

- [Root Layout](#root-layout)
- [Navbar](#navbar)
- [Footer](#footer)
- [ProfileModal (Replaced)](#profilemodal-replaced)
- [LoginModal](#loginmodal)
- [ModalViewbox](#modalviewbox)
- [Toast](#toast)
- [HelpHeader](#helpheader)
- [ThemeProvider](#themeprovider)
- [DevtoolProtection](#devtoolprotection)
- [LazyMotionWrapper](#lazymotionwrapper)
- [MarkdownRenderer](#markdownrenderer)
- [shadcn/ui Components](#shadcnui-components)
- [Cross-References](#cross-references)

---

## Root Layout

**File:** `src/app/layout.tsx`

The root layout wraps the entire application with providers and global utilities. The wrapping order is critical — each provider depends on or augments those above it.

### Provider Wrapping Order

From outermost to innermost:

```
<html>
  <body>
    <QueryProvider>                 ← TanStack React Query (QueryClientProvider)
      <LazyMotionWrapper>           ← Framer Motion (domAnimation features, lazy)
        <ToastProvider>             ← Toast notification context (max 5 toasts)
          <AuthProvider>            ← Supabase auth session state
            <ModalViewboxProvider>  ← Payment modal stack context
              <DevtoolProtection /> ← Browser devtools detection (prod only)
              <NoRightClick>        ← Right-click prevention wrapper
                {children}          ← Page content
              </NoRightClick>
              <ModalViewbox />      ← Global modal overlay (renders at root)
            </ModalViewboxProvider>
          </AuthProvider>
        </ToastProvider>
      </LazyMotionWrapper>
    </QueryProvider>
    <Analytics />                   ← Vercel Analytics
    <SpeedInsights />               ← Vercel Speed Insights
  </body>
</html>
```

### Fonts

Three font families are loaded and exposed as CSS custom properties:

| Font | CSS Variable | Usage |
|------|-------------|-------|
| **Geist Sans** | `--font-geist-sans` | Primary body text, UI elements |
| **Geist Mono** | `--font-geist-mono` | Code blocks, monospace contexts |
| **Orbitron** | `--font-orbitron` | Display/accent font. Weights: 400, 700, 900. Used in trending rank numbers and hero elements. |

### Metadata

- **Title template:** `"%s | Genesis Studio"` — each page provides its own `%s` segment
- **OpenGraph defaults:** Standard OG meta tags for social sharing
- **JSON-LD:** `Organization` schema for structured data / SEO
- **Favicons:** `/favicon.ico`, `/icon.svg`, `/apple-touch-icon.png`

---

## Navbar

**File:** `src/app/components/common/Navbar.tsx` (~1013 lines)

Fixed-position top navigation bar. The single most complex component in the application due to responsive behavior, search, scroll-aware visibility, and profile integration.

### Desktop Layout (md+ breakpoint)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GENESIS   Novels   Library   Store   [  Search...  ]   🔔  ☀️/🌙  👤  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| **GENESIS** logo | Link to `/` (homepage) |
| **Novels** | Link to `/novels` |
| **Library** | Link to `/library` |
| **Store** | Link to `/store` |
| **Search bar** | Full-width on `xl+`, expandable icon button on `md–lg` |
| **Announcements** | Bell icon, links to `/announcements` |
| **Theme toggle** | Sun icon (light) / Moon icon (dark), toggles theme class |
| **Profile** | Avatar button (authenticated) or user icon (unauthenticated) |

### Mobile Layout (&lt;md breakpoint)

```
┌────────────────────────────────┐
│  GENESIS          🔔    ☰      │
└────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| **GENESIS** logo | Link to `/` |
| **Announcements** | Bell icon, links to `/announcements` |
| **Hamburger** | Opens mobile drawer |

### Active Route Indicator

The currently active route is highlighted with a cyan (`#22D3EE`) underline below the corresponding nav link.

### Scroll Auto-Hide

The Navbar auto-hides on scroll down and reappears on scroll up:

- Uses the `useScrollBehavior` custom hook
- Velocity-based animation duration — faster scrolling = faster hide/show
- Spring-based vertical slide animation via Framer Motion
- The Navbar slides up off-screen (negative `y` transform) rather than fading

### Search

- Controlled `<input>` element with real-time filtering
- Data source: all novels from the `useNovels()` React Query hook (client-side filtering)
- Dropdown results panel shows:
  - Cover image thumbnail
  - Novel title
- Clicking a result navigates to `/novels/[abbreviation]`
- Escape key or clicking outside closes the dropdown

### Profile Button

**Authenticated state:**
- Displays the user's avatar image (from `user.profile.profile_picture`)
- Click opens `SettingsDropdown` (desktop) — replaces the former `ProfileModal`

**Unauthenticated state:**
- Displays a generic user icon
- Click opens `LoginModal`

### Mobile Drawer

> **Note:** The mobile drawer has been extracted to `SettingsDrawer` (`src/app/components/settings/SettingsDrawer.tsx`). See [20 — Settings & Profile](./20-UI-Settings-Profile.md) for full documentation.

A right-sliding frosted-glass panel animated with Framer Motion (`x: 100%` → `0`):

| Section | Content |
|---------|---------|
| **User info** | Avatar image, display name, badge row (Supporter, Newcomer, Staff) |
| **Wallet** | Helix balance with `HelixIcon`, Atom balance |
| **Navigation** | Novels (with description), Library, Store — each with a chevron arrow |
| **Theme toggle** | Light/dark mode switch |
| **Sign Out** | Button to end session |

### WalletDisplay

**File:** `src/app/components/common/WalletDisplay.tsx`

Inline display of the user's Helix balance alongside the `HelixIcon`. Shown in:
- Navbar (desktop, next to profile)
- Mobile drawer (wallet section)

---

## Footer

**File:** `src/app/components/common/Footer.tsx`

### Social Links

A row of social media icons with theme-aware variants:

| Platform | Icon Source |
|----------|------------|
| Discord | SVG from `/footer/` directory |
| Facebook | SVG from `/footer/` directory |
| Instagram | SVG from `/footer/` directory |
| Reddit | SVG from `/footer/` directory |
| TikTok | SVG from `/footer/` directory |

Each icon has both light and dark theme variants loaded from the `/footer/` directory.

### Content

- **Copyright:** "2025 Genesis Studio. All rights reserved."
- **Links:** Privacy Policy (`/privacy`) | Terms of Service (`/terms-of-service`)

### Responsive Behavior

- **Mobile:** All content centered, stacked vertically
- **Desktop:** Content spread horizontally with social links, copyright, and legal links in a row

---

## ProfileModal (Replaced)

**Original file:** `src/app/components/common/ProfileModal.tsx`

> **Status:** ProfileModal has been **replaced** by `SettingsDropdown` (`src/app/components/settings/SettingsDropdown.tsx`). The mobile variant has been extracted to `SettingsDrawer` (`src/app/components/settings/SettingsDrawer.tsx`).
>
> See [20 — Settings & Profile](./20-UI-Settings-Profile.md) for complete documentation of the settings system.

The original ProfileModal was a desktop dropdown/popover anchored below the profile avatar button in the Navbar. Its functionality (profile display, wallet, billing, sign-out) has been absorbed into the new settings system, which provides a unified experience across desktop and mobile.

### Legacy Profile Sub-Components

Located in `src/app/components/profile/`:

| Component | File | Purpose |
|-----------|------|---------|
| **Billing** | `Billing.tsx` | Payment and transaction history display |
| **Luminaries** | `Luminaries.tsx` | Active Luminary subscription management |
| **JobApplications** | `JobApplications.tsx` | Job application status tracking |

---

## LoginModal

**File:** `src/app/components/auth/LoginModal.tsx`

Full-screen overlay for authentication, animated with Framer Motion.

- **Sign In / Sign Up** toggle between modes
- **OAuth buttons:** Google, Discord
- **Email/password** form with validation
- **Forgot password** link/flow

> See [doc 05](./05-Authentication-System.md) for complete authentication flow documentation.

---

## ModalViewbox

**File:** `src/app/components/payment/ModalViewbox.tsx`

Global modal overlay rendered at the root layout level (inside `ModalViewboxProvider`). This is the primary modal system for payment-related flows.

### Behavior

- Reads `currentModal.type` from `ModalViewboxContext` to determine which content component to render
- **Animated:** Backdrop fades in (opacity) + content scales in (scale + opacity entrance)
- **Back button:** Visible when `canGoBack` is `true` (modal stack depth > 1)
- **Close button:** Always available

### Modal Content Components

Located in `src/app/components/payment/ModalContents/`:

| Component | Modal Type | Purpose |
|-----------|------------|---------|
| `UnlockOptionsContent` | `unlock-options` | Choose between Helix unlock vs. subscription |
| `HelixUnlockContent` | `helix-unlock` | Confirm Helix-based chapter unlock |
| `InsufficientHelixContent` | `insufficient-helix` | Insufficient balance warning with link to store |
| `HelixPurchaseContent` | `helix-purchase` | Helix purchase flow with Stripe Elements |
| `NovelSubscriptionContent` | `novel-subscription` | Novel subscription with cover art, tier selection |

### Modal Stack

The `ModalViewboxContext` maintains a stack of modals. This allows flows like:

```
UnlockOptions → InsufficientHelix → HelixPurchase
```

The user can navigate back through the stack or close the entire modal at any point.

> See [doc 06](./06-Payment-Subscription-System.md) for the detailed payment modal flow and state transitions.

---

## Toast

**File:** `src/app/components/common/Toast.tsx`

Notification toasts for transient feedback (success, error, warning, info).

### Types

| Type | Color | Usage |
|------|-------|-------|
| `success` | Green | Payment confirmed, action completed |
| `error` | Red | Payment failed, API error |
| `warning` | Yellow | Insufficient balance, expiring session |
| `info` | Blue | General information, tips |

### Props

```ts
interface ToastProps {
  id: string;            // Unique identifier
  type: ToastType;       // 'success' | 'error' | 'warning' | 'info'
  title: string;         // Bold headline
  message?: string;      // Optional body text
  duration?: number;     // Auto-dismiss time in ms (default: 5000)
  onClose: () => void;   // Dismiss callback
}
```

### Animation

- **Entry:** Slides in from the right (CSS keyframe `slide-in-right`)
- **Exit:** Slides out to the right (CSS keyframe `slide-out-right`)
- **Progress bar:** Shrinking width bar at the bottom (CSS keyframe `shrink-width`) showing remaining time

### Positioning

- Fixed position: `top-4 right-4`
- Z-index: `z-[10002]` (above modals)
- Maximum of 5 toasts visible simultaneously (managed by `ToastProvider`)

---

## HelpHeader

**File:** `src/app/components/common/HelpHeader.tsx`

Shared header component for informational pages.

### Props

```ts
interface HelpHeaderProps {
  title: string;      // Page title
  keyword: string;    // Cyan-highlighted word within the title
  subtitle: string;   // Supporting description text
}
```

### Rendering

- **Breadcrumb:** "Help Center > \{title\}" navigation trail
- **Headline:** Large heading with `keyword` rendered in accent cyan (`#22D3EE`)
- **Subtitle:** Muted text below the headline
- **Background:** Full-bleed colored background

### Used On

- About page (`/about`)
- Privacy Policy page (`/privacy`)
- Terms of Service page (`/terms-of-service`)

---

## ThemeProvider

**File:** `src/app/components/common/ThemeProvider.tsx`

Manages the application's light/dark theme state.

### Mechanism

- `applyThemeClass()` utility function adds either `theme-dark` or `theme-light` class to the `<html>` element
- The Navbar's theme toggle button calls this function on click
- Theme preference is persisted to `localStorage`
- On initial load, the saved preference is read and applied before first paint

### CSS Integration

The theme classes drive styling throughout `globals.css`:

```css
.theme-dark {
  /* Dark mode overrides with !important */
}
.theme-light {
  /* Light mode defaults */
}
```

> See [doc 17](./17-UI-Styling-System.md) for full dark mode system documentation.

---

## DevtoolProtection

**File:** `src/app/components/common/DevtoolProtection.tsx`

Production-only browser devtools detection and prevention.

### Implementation

- Uses the `disable-devtool` library
- **Only active in production builds** (`process.env.NODE_ENV === 'production'`)
- Does nothing in development

### Detection Methods

- F12 key press
- Ctrl+Shift+I shortcut
- Right-click "Inspect" context menu
- Direct console access attempts

---

## LazyMotionWrapper

**File:** `src/components/motion/LazyMotionWrapper.tsx`

Wraps the entire application in Framer Motion's `LazyMotion` provider with `domAnimation` features.

### Purpose

- **Bundle size reduction:** Reduces Framer Motion's footprint by ~50KB
- Only loads animation features when they are actually used by a component
- Components must use `m.div` (lazy-compatible) instead of `motion.div`

### Usage

```tsx
import { m } from 'framer-motion';

// ✅ Correct — lazy-compatible
<m.div animate={{ opacity: 1 }} />

// ❌ Incorrect — imports full bundle
<motion.div animate={{ opacity: 1 }} />
```

---

## MarkdownRenderer

**File:** `src/components/MarkdownRenderer.tsx`

Renders Markdown content to styled HTML using `react-markdown`.

### Dependencies

| Package | Purpose |
|---------|---------|
| `react-markdown` | Core Markdown → React rendering |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough, task lists) |
| `rehype-raw` | Allows raw HTML within Markdown content |

### Custom Renderers

| Element | Customization |
|---------|---------------|
| `h1`–`h6` | Styled headings with appropriate sizing and spacing |
| `p` | Paragraph with proper line-height and spacing |
| `ul` / `ol` | Styled lists with custom bullet/number styling |
| `a` | Links — external URLs open in a new tab (`target="_blank"`) |
| `code` / `pre` | Styled code blocks with syntax-appropriate fonts |
| `table` | Responsive wrapper with horizontal scroll |
| `blockquote` | Left-bordered styled callout |
| `img` | Rendered as Next.js `Image` component for optimization |

### Used In

- Announcements page (announcement content)
- About page
- Privacy Policy / Terms of Service
- Chapter content (reader view)

---

## shadcn/ui Components

Located in `src/components/ui/`:

### DropdownMenu

**File:** `src/components/ui/dropdown-menu.tsx`

- Built on `@radix-ui/react-dropdown-menu`
- Used in: Navbar profile menu, settings dropdowns
- Accessible keyboard navigation and focus management

### Skeleton

**File:** `src/components/ui/skeleton.tsx`

- Shimmer animation with pulse effect
- Base component for all page-level skeleton loading states
- Accepts `className` for size/shape customization

> See [doc 17](./17-UI-Styling-System.md) for the full skeleton loading system.

---

## Cross-References

| Doc | Relevance |
|-----|-----------|
| [05 — Authentication System](./05-Authentication-System.md) | LoginModal details, auth flow, OAuth providers |
| [06 — Payment & Subscription System](./06-Payment-Subscription-System.md) | ModalViewbox payment flows, modal content components |
| [08 — State Management](./08-State-Management.md) | Context providers (Auth, Toast, ModalViewbox), React Query |
| [17 — UI: Styling System](./17-UI-Styling-System.md) | Theme system, dark mode, skeleton loading, CSS architecture |
| [20 — Settings & Profile](./20-UI-Settings-Profile.md) | SettingsDropdown, SettingsDrawer, profile management (replaces ProfileModal) |
