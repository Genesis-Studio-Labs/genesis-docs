---
id: "20-UI-Settings-Profile"
slug: "/20-UI-Settings-Profile"
sidebar_position: 20
sidebar_label: "Settings & Profile"
---

# 20 — UI: Settings & Profile

> The settings system provides user profile management, billing history, device management, and support access through responsive drawer/dropdown entry points and dedicated settings pages.
>
> Last updated: March 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Settings Drawer (Mobile)](#2-settings-drawer-mobile)
3. [Settings Dropdown (Desktop)](#3-settings-dropdown-desktop)
4. [Shared Components](#4-shared-components)
5. [Settings Pages](#5-settings-pages)
6. [Data Flow](#6-data-flow)
7. [Page Layout Pattern](#7-page-layout-pattern)
8. [Cross-References](#8-cross-references)

---

## 1. Overview

The settings system consists of two entry points and a set of dedicated pages:

| Component | Purpose |
|-----------|---------|
| **Mobile Settings Drawer** | Full-width right-sliding panel (replaces old Navbar drawer) |
| **Desktop Settings Dropdown** | Positioned below the navbar profile button |
| **Settings Pages** | Account, Billing, Contact/FAQ, Devices |

The drawer and dropdown share the same internal component hierarchy — `ProfileHeader`, `WalletRow`, `StatsRow`, and `SettingsNavItem` — ensuring visual and behavioral parity across breakpoints.

---

## 2. Settings Drawer (Mobile)

**File:** `src/app/components/settings/SettingsDrawer.tsx`

A full-width panel that slides in from the right side of the viewport, replacing the old Navbar mobile drawer.

### Rendering

- Uses `createPortal` to render into `document.body`, ensuring it sits above all other content
- Animated with Framer Motion (`x: "100%"` → `x: 0`)
- Frosted glass backdrop overlay behind the panel
- Hidden on desktop viewports (`md:hidden`)

### Section Layout

```
┌─────────────────────────────────┐
│  ProfileHeader                  │
│  WalletRow                      │
│  StatsRow                       │
│─────────────────────────────────│
│  Novels            ›            │
│  Library            ›           │
│  Store              ›           │
│  My Account         ›           │
│  Billing & Invoices ›           │
│  Contact Us         ›           │
│  Theme Toggle                   │
│  Sign Out                       │
└─────────────────────────────────┘
```

### Key Behaviors

- **No divider** between ProfileHeader, WalletRow, and StatsRow — they appear as a unified block
- Active page is highlighted in teal using `usePathname()` for route matching
- No "Settings" title at the top
- No social links section
- No "My Account" duplication in the navigation — the account page is accessed via a dedicated nav item

---

## 3. Settings Dropdown (Desktop)

**File:** `src/app/components/settings/SettingsDropdown.tsx`

A fixed-width dropdown popover that replaces the old `ProfileModal.tsx`.

### Positioning

- **Width:** 320px fixed
- **Position:** Anchored directly below the navbar profile button with a 1px vertical overlap to prevent visual gaps
- Returns `null` on mobile viewports (rendering is suppressed entirely, not just hidden with CSS)

### Section Layout

Same internal structure as the drawer (ProfileHeader → WalletRow → StatsRow → navigation items) minus the Novels, Library, and Store nav items, which are already accessible from the desktop navbar.

---

## 4. Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| **ProfileHeader** | `src/app/components/settings/ProfileHeader.tsx` | Profile picture, display name, @username, level badge, tags |
| **WalletRow** | `src/app/components/settings/WalletRow.tsx` | Helix + Atom balance display with Purchase button |
| **StatsRow** | `src/app/components/settings/StatsRow.tsx` | Streak count + chapters read side by side |
| **SettingsNavItem** | `src/app/components/settings/SettingsNavItem.tsx` | Navigation row with icon, label, chevron, active state |

### ProfileHeader

**File:** `src/app/components/settings/ProfileHeader.tsx`

Displays user identity information in a compact vertical layout:

| Row | Content |
|-----|---------|
| **Row 1** | Display name + "Lv. X" badge |
| **Row 2** | @username |
| **Row 3** | Tags (Luminary, Supporter, New, Staff) |

**Tag logic:**

| Tag | Condition |
|-----|-----------|
| **Luminary** | User has any active subscription |
| **Supporter** | Manually assigned supporter status |
| **New** | Recently created account |
| **Staff** | Staff role flag |

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `size` | `'default' \| 'large'` | Controls sizing of avatar and text |
| `clickable` | `boolean` | Whether the header acts as a link |

**Level calculation:** Derived from `site_currencies.lifetime_shards` using the formula `floor(sqrt(lifetime_shards / 50)) + 1`. See [Data Flow](#6-data-flow) for thresholds.

### WalletRow

**File:** `src/app/components/settings/WalletRow.tsx`

Displays the user's Helix and Atom balances inline with a "Purchase" button that links to `/store?tab=Helixes`.

### StatsRow

**File:** `src/app/components/settings/StatsRow.tsx`

Two statistics displayed side by side:

| Stat | Source |
|------|--------|
| **Streak** | Consecutive days with reading activity |
| **Chapters Read** | Total chapters read count |

### SettingsNavItem

**File:** `src/app/components/settings/SettingsNavItem.tsx`

A single navigation row used in both the drawer and dropdown:

- Icon on the left
- Label text
- Right-facing chevron on the right
- Active state: teal highlight applied when `usePathname()` matches the item's route

---

## 5. Settings Pages

### 5.1 My Account

| Aspect | Detail |
|--------|--------|
| **File** | `src/app/settings/account/page.tsx` |
| **Route** | `/settings/account` |
| **Auth Required** | Yes |

#### Profile Picture Upload

- Camera overlay icon appears on hover over the current avatar
- Upload is stored in Supabase Storage
- Image updates immediately on successful upload

#### Editable Fields

| Field | Validation |
|-------|------------|
| **Email** | Standard email format |
| **Username** | Unique, lowercase only, real-time availability check |
| **Display Name** | Free-form text |
| **Birthday** | Date picker |
| **Gender** | Selection field |

Each field toggles into an inline edit mode with save/cancel controls. No full-page edit form — edits happen in place.

#### Username Validation

```
User types username
  → Client-side format validation (lowercase, allowed characters)
    → Debounced API call to /api/profile/check-username
      → Response indicates availability
        ├─ Available → green checkmark
        └─ Taken → red error message
```

#### Change Password

Uses `supabase.auth.updateUser()` to update the user's password directly through the Supabase Auth API.

#### Connected Accounts

Shows OAuth provider connection status sourced from `session.user.app_metadata.providers` array:

| Provider | Connected State | Unconnected State |
|----------|----------------|-------------------|
| **Google** | Shows "Connected" indicator | Clickable → triggers `supabase.auth.linkIdentity()` |
| **Discord** | Shows "Connected" indicator | Clickable → triggers `supabase.auth.linkIdentity()` |

#### Additional Actions

- **Manage Devices** — link to `/settings/account/devices`
- **Sign Out** — small text button with `LogOut` icon, no background styling

---

### 5.2 Manage Devices

| Aspect | Detail |
|--------|--------|
| **File** | `src/app/settings/account/devices/page.tsx` |
| **Route** | `/settings/account/devices` |
| **Auth Required** | Yes |

Lists active sessions retrieved from `auth.sessions` via the `get_user_sessions` RPC call.

#### Session Display

Each session row shows:

| Element | Source |
|---------|--------|
| **Device icon** | Determined by parsed user agent |
| **Browser + OS** | Parsed from `user_agent` string |
| **IP address** | Session IP |
| **Last active** | Relative time (e.g., "2 hours ago") |

#### Actions

- **Current session badge** — visual indicator on the session matching the current browser
- **Sign out** button on each non-current session
- **"Sign out all other devices"** button at the bottom

---

### 5.3 Billing & Invoices

| Aspect | Detail |
|--------|--------|
| **File** | `src/app/settings/billing/page.tsx` |
| **Route** | `/settings/billing` |
| **Auth Required** | Yes |

#### Manage On Section

Two large provider buttons:

| Provider | Action |
|----------|--------|
| **Stripe** | POST to `/api/billing/portal/stripe` → redirects to Stripe Customer Portal |
| **PayPal** | Navigates to `/settings/billing/paypal` |

#### Transaction List

- Search/filter bar for filtering transactions
- Transactions grouped by date, sourced from the `payment_logs` view
- Description patterns:
  - `"Helix Purchase on {Provider}"`
  - `"Luminary Purchase/Recurring on {Provider}"`

#### Pack Name Mapping

| Helix Amount | Pack Name |
|--------------|-----------|
| 600 | Starter |
| 1700 | Popular |
| 3800 | Value |
| 6500 | Premium |
| 10300 | Ultimate |

---

### 5.4 PayPal Subscriptions

| Aspect | Detail |
|--------|--------|
| **File** | `src/app/settings/billing/paypal/page.tsx` |
| **Route** | `/settings/billing/paypal` |
| **Auth Required** | Yes |

Lists PayPal subscriptions from the `subscriptions` table.

Each subscription row displays:

| Element | Detail |
|---------|--------|
| **Novel title** | The subscribed novel's name |
| **Status badge** | Active, Cancelled, etc. |
| **Manage link** | "Manage on PayPal" → `paypal.com/myaccount/autopay/connect/{subscription_id}` |

---

### 5.5 Contact Us & FAQ

| Aspect | Detail |
|--------|--------|
| **File** | `src/app/settings/contact/page.tsx` |
| **Route** | `/settings/contact` |
| **Auth Required** | No |

#### Contact Rows

Sourced from the Directus `contactus` singleton:

| Contact Type | Fields |
|-------------|--------|
| **Business** | `business_mail`, `business_body` |
| **Support** | `support_mail`, `support_body` |
| **Jobs** | `jobs_mail`, `jobs_body` |

#### FAQ Category Cards

Displayed in a 2x2 grid on mobile, 4 columns on desktop. Each card links to `/settings/contact/faq/[category]`.

| Category | Icon |
|----------|------|
| General | `HelpCircle` |
| Payment & Billing | `CreditCard` |
| Helix & Atoms | `Coins` |
| Luminaries | `Crown` |

---

### 5.6 FAQ Category Page

| Aspect | Detail |
|--------|--------|
| **File** | `src/app/settings/contact/faq/[category]/page.tsx` |
| **Route** | `/settings/contact/faq/[category]` |
| **Auth Required** | No |

- Dynamic route that validates the `category` parameter against known categories
- FAQ items rendered as accordion panels with a rotating chevron indicator
- Data fetched from the Directus `faq` collection, filtered by category

---

## 6. Data Flow

### Display Name Resolution

The display name shown in ProfileHeader follows a fallback chain:

```
display_name → username → user.name → email prefix → "User"
```

The first non-empty value in the chain is used.

### Level System

| Aspect | Detail |
|--------|--------|
| **Source** | `site_currencies.lifetime_shards` |
| **Formula** | `floor(sqrt(lifetime_shards / 50)) + 1` |
| **Utility** | `src/lib/level.ts` |

**Level thresholds:**

| Level | Lifetime Shards Required |
|-------|--------------------------|
| 1 | 0 |
| 2 | 50 |
| 3 | 200 |
| 5 | 800 |
| 10 | 4,050 |
| 15 | 9,800 |

### React Query Hooks

| Hook | File | Endpoint |
|------|------|----------|
| `useProfileStats` | `src/hooks/queries/useProfileStats.ts` | `GET /api/profile/stats` |
| `useTransactions` | `src/hooks/queries/useTransactions.ts` | `GET /api/transactions` |
| `useFaq` | `src/hooks/queries/useFaq.ts` | `GET /api/directus/faq` |
| `useContactUs` | `src/hooks/queries/useContactUs.ts` | `GET /api/directus/contactus` |
| `useDevices` | `src/hooks/queries/useDevices.ts` | `GET /api/auth/devices` |

---

## 7. Page Layout Pattern

All settings pages follow the standard site layout pattern:

```
Navbar → spacer (72px mobile / 56px desktop) → main content (max-w-[1048px]) → Footer
```

Auth-gated pages (Account, Billing, Devices) redirect to `/` if the user is not authenticated. Contact and FAQ pages are publicly accessible.

---

## 8. Cross-References

| Doc | Relevance |
|-----|-----------|
| [04 — API Reference](./04-API-Reference.md) | Endpoint details for profile stats, transactions, username check, billing portal |
| [02 — Database Schema](./02-Database-Schema.md) | `site_currencies`, `payment_logs`, `subscriptions`, `auth.sessions` tables |
| [05 — Authentication System](./05-Authentication-System.md) | Supabase Auth, OAuth linking, session management, `useAuth` hook |
| [06 — Payment & Subscription System](./06-Payment-Subscription-System.md) | Stripe Customer Portal, PayPal subscriptions, payment flow details |
| [16 — UI: Common Components](./16-UI-Common-Components.md) | Navbar integration, Footer, ModalViewbox, Toast |
