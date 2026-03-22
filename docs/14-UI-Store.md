---
id: "14-UI-Store"
slug: "/14-UI-Store"
sidebar_position: 14
sidebar_label: "UI: Store"
---

# 14 — UI: Store Page

> The Genesis Studio store offers two monetization channels — Luminary novel subscriptions and Helix currency packs — presented via a tabbed interface with dramatic visual design and integrated Stripe/PayPal payment flows.

---

## Table of Contents

- [Page Structure](#page-structure)
- [Visual Design](#visual-design)
- [Luminary Subscriptions Tab](#luminary-subscriptions-tab)
- [Helixes Tab](#helixes-tab)
- [Store Components](#store-components)
- [Purchase Flows](#purchase-flows)
- [Cross-References](#cross-references)

---

## Page Structure

| Aspect | Detail |
|--------|--------|
| **Server Component** | `src/app/store/page.tsx` — exports metadata, renders `StoreClient` |
| **Client Component** | `src/app/store/StoreClient.tsx` — all interactive store logic |
| **Route** | `/store` |
| **Tabs** | Luminary Subscriptions, Helixes |

### Tab Navigation

The store uses a secondary tab bar that sits directly below the main Navbar. This is **not** a standalone tab component — it is integrated into the Navbar layout as a second row, providing seamless visual continuity between the site navigation and the store's section navigation.

```
┌─────────────────────────────────────────────────┐
│  GENESIS   Novels   Library   Store   🔍  👤    │  ← Main Navbar
├─────────────────────────────────────────────────┤
│     [Luminary Subscriptions]    [Helixes]        │  ← Secondary tab bar
└─────────────────────────────────────────────────┘
```

- Active tab is indicated with an underline accent
- Tab state is managed locally within `StoreClient.tsx`
- Switching tabs swaps the rendered content below the hero

---

## Visual Design

The store page uses a dramatic, immersive backdrop to elevate the purchasing experience:

- **Fixed background imagery**: Full-viewport background image anchored with `position: fixed` so content scrolls over it
- **Vignette gradients**: Dark radial gradient overlays at the edges, drawing focus toward the center content
- **Gradient orb effects**: Soft, blurred color orbs (typically cyan/purple hues) positioned behind content for depth
- **Each tab has its own hero section** with distinct theming:
  - Luminary tab: Gold/warm tones reflecting the premium subscription nature
  - Helixes tab: Cyan/blue tones matching the Helix currency branding

---

## Luminary Subscriptions Tab

**File:** `src/app/store/SubscriptionsTab.tsx`

### Hero Section

Rendered via the shared `HeroSection` component (see [Store Components](#store-components)):

| Prop | Value |
|------|-------|
| `icon` | Luminary icon loaded from `/icons/luminary.png` |
| `title` | Headline text promoting Luminary subscriptions |
| `description` | Paragraph describing subscription benefits |
| `ctaText` | Primary CTA button text |

### Feature Cards

Three feature cards displayed in a responsive row below the hero:

| Icon | Title | Description |
|------|-------|-------------|
| `BookOpen` | "Read Unlocked" | Access all chapters in subscribed novels |
| `Heart` | "Support Creators" | Directly fund the authors you love |
| `Shield` | "Premium Experience" | Ad-free reading with exclusive perks |

Each card renders an icon, title, and short description in a styled card container.

### NovelSubscriptionCards

**File:** `src/app/store/NovelSubscriptionCards.tsx`

A responsive grid of per-novel subscription cards. Each card represents one novel that offers a Luminary subscription tier.

**Card contents:**

| Element | Detail |
|---------|--------|
| Cover image | Novel cover art (Directus/Cloudflare CDN) |
| Title | Novel name |
| Price | `$29.99/month` |
| CTA | "Subscribe" button |

**Interaction:**

- Clicking a card opens `ModalViewbox` with modal type `novel-subscription`
- The modal receives the selected novel's data as context
- See [doc 06](./06-Payment-Subscription-System.md) for the full subscription flow

**Loading state:**

`NovelSubscriptionCardsSkeleton` renders placeholder shimmer cards matching the grid layout dimensions while data is being fetched.

---

## Helixes Tab

**File:** `src/app/store/HelixesTab.tsx`

### Hero Section

Rendered via the shared `HeroSection` component:

| Prop | Value |
|------|-------|
| `icon` | `HelixIcon` component |
| `title` | Headline text promoting Helix currency |
| `description` | Paragraph describing Helix usage and value |
| `ctaText` | Primary CTA button text |

### Feature Cards

Three feature cards displayed below the hero:

| Icon | Title | Description |
|------|-------|-------------|
| `BookOpen` | "Unlock Chapters" | Use Helixes to unlock individual chapters |
| `Clock` | "Permanent Access" | Unlocked chapters are yours forever |
| `Heart` | "Support Authors" | Every Helix purchase supports the creators |

### HelixBundleCards

**File:** `src/app/store/HelixBundleCards.tsx`

A grid of five Helix pack purchase tiers:

| Tier | Helixes | Bonus | Price (USD) | Badge |
|------|---------|-------|-------------|-------|
| **Starter** | 600 | — | $9.99 | — |
| **Popular** | 1,600 | +100 bonus | $24.99 | "Most Popular" |
| **Value** | 3,500 | +300 bonus | $49.99 | — |
| **Premium** | 5,900 | +600 bonus | $74.99 | — |
| **Ultimate** | 9,300 | +1,000 bonus | $99.99 | — |

**Card contents:**

| Element | Detail |
|---------|--------|
| Helix amount | Large number with HelixIcon |
| Bonus badge | Conditionally rendered "+X bonus" tag if the tier includes bonus Helixes |
| Price | USD price |
| CTA | "Buy" button |
| Highlight | The "Popular" pack is visually distinguished with a "Most Popular" badge and accent border |

**Interaction:**

- Clicking a card opens `HelixPurchaseModal` or `ModalViewbox` with modal type `helix-purchase`
- The modal receives the selected pack's tier data (amount, price, bonus)

---

## Store Components

### HeroSection

**File:** `src/app/store/HeroSection.tsx`

Shared hero layout used by both tabs. Provides a consistent visual structure with per-tab content.

```ts
interface HeroSectionProps {
  icon: ReactNode;       // Icon element (Luminary image or HelixIcon)
  title: string;         // Headline text
  description: string;   // Supporting paragraph
  ctaText: string;       // CTA button label
  onCtaClick: () => void; // CTA click handler
}
```

**Layout:**
- Centered content with icon above the title
- Title rendered in a large, bold font
- Description in muted text below
- CTA button with accent styling and hover animation

### HelixIcon

**File:** `src/app/store/HelixIcon.tsx`

SVG-based Helix currency icon used throughout the store and wallet displays.

```ts
interface HelixIconProps {
  size?: number;   // Icon dimensions in px (default varies by context)
  color?: string;  // Fill color (default: accent cyan or gradient)
}
```

- Renders the double-helix currency symbol
- Supports animated gradient fill or solid color fill
- Used in: HelixBundleCards, WalletDisplay, HelixPurchaseModal, ProfileModal

### HelixPurchaseModal

**File:** `src/app/store/HelixPurchaseModal.tsx`

Standalone modal for completing Helix pack purchases with Stripe Elements integration.

- Displays selected pack details (amount, bonus, price)
- Embeds `CheckoutForm` with Stripe Elements for card input
- Handles payment confirmation and error states
- On success: webhook credits wallet → success toast displayed

### NovelSubscriptionCards

**File:** `src/app/store/NovelSubscriptionCards.tsx`

Responsive grid of novel subscription options. Fetches available novels with subscription tiers and renders a card for each.

### HelixBundleCards

**File:** `src/app/store/HelixBundleCards.tsx`

Responsive grid of Helix bundle purchase options. Renders the five predefined tiers with appropriate styling and badges.

---

## Purchase Flows

### Buy Helixes

```
User selects Helix pack
  → HelixPurchaseContent modal opens (via ModalViewbox or HelixPurchaseModal)
    → Stripe Elements renders (CheckoutForm component)
      → User enters payment details
        → Payment confirmed via Stripe API
          → Stripe webhook fires → credits user's Helix wallet in Supabase
            → Success toast displayed to user
```

### Subscribe to Novel (Luminary)

```
User selects novel subscription card
  → NovelSubscriptionContent modal opens (via ModalViewbox)
    → User reviews subscription details (novel, price, billing cycle)
      → Stripe or PayPal payment method selected
        → Payment processed
          → Webhook activates subscription in Supabase
            → User gains access to all novel chapters
```

> See [doc 06](./06-Payment-Subscription-System.md) for complete payment flow details including webhook handling, error recovery, and Stripe/PayPal integration specifics.

---

## Cross-References

| Doc | Relevance |
|-----|-----------|
| [06 — Payment & Subscription System](./06-Payment-Subscription-System.md) | Full payment flow, Stripe Elements, webhook processing |
| [08 — State Management](./08-State-Management.md) | ModalViewboxContext, React Query hooks for store data |
| [16 — UI: Common Components](./16-UI-Common-Components.md) | ModalViewbox, Toast, Navbar (secondary tab bar) |
