---
id: "12-UI-Chapter-Viewer"
slug: "/12-UI-Chapter-Viewer"
sidebar_position: 12
sidebar_label: "UI: Chapter Viewer"
---

# 12 — UI: Chapter Viewer

> The chapter viewer is a full-screen immersive reading experience with no Navbar or Footer. It features auto-hiding floating controls, extensive reader customization (themes, fonts, sizing), a chapter navigation drawer, content protection for paid content, and access control that gates locked chapters behind Helix purchases or subscriptions.

---

## Table of Contents

- [Page Structure](#page-structure)
- [Data Fetching](#data-fetching)
- [Components](#components)
- [Floating Controls](#floating-controls)
- [Comments Integration](#comments-integration)
- [Reader Settings](#reader-settings)
- [Content Protection](#content-protection)
- [Custom CSS](#custom-css)
- [Access Control Decision Tree](#access-control-decision-tree)
- [Loading States](#loading-states)
- [Cross-References](#cross-references)

---

## Page Structure

**Route:** `/viewer/[chapterId]`

**File:** `src/app/viewer/[chapterId]/page.tsx`

Directive: `"use client"`

This is a full-screen immersive layout with **no Navbar** and **no Footer**. The entire viewport is dedicated to reading content with custom floating controls that auto-hide after inactivity.

### Page Composition

```tsx
{loading ? (
  <LoadingStates />
) : isLocked ? (
  <LockedChapterView ... />
) : (
  <div style={{ background: THEMES[theme].bg, color: THEMES[theme].text }}>
    {/* Top floating controls (animated) */}
    <m.div animate={{ y: showControls ? 0 : -100 }}>
      <BackButton /> <ChapterTitlePill /> <MenuButton />
    </m.div>

    {/* Chapter content */}
    <ChapterContent content={chapter.content} />

    {/* Bottom floating controls (animated) */}
    <m.div animate={{ y: showControls ? 0 : 100 }}>
      <HeartButton /> <CommentsButton /> <SettingsDropdown /> <PrevNextArrows />
    </m.div>

    {/* Side drawers */}
    <ChapterDrawer ... />
    <CommentDrawer ... />
  </div>
)}
```

### Key Imports

| Import | Source | Purpose |
|--------|--------|---------|
| `useAuth` | `context/AuthContext` | User authentication state |
| `useToast` | `context/ToastContext` | Toast notifications |
| `useWallet` | `hooks/useWallet` | Helix balance and chapter unlock |
| `useModalViewbox` | `context/ModalViewboxContext` | Opens unlock/subscription modals |
| `LockedChapterView` | `components/novels/LockedChapterView` | Locked chapter paywall UI |
| `ChapterContent` | `components/novels/ChapterContent` | Renders chapter HTML content |
| `ChapterDrawer` | `components/novels/ChapterDrawer` | Side panel chapter list |
| `LoadingStates` | `components/novels/LoadingStates` | Loading/error state wrapper |
| `CommentDrawer` | `components/comments/CommentDrawer` | Chapter comments panel |
| `DropdownMenu` | `components/ui/dropdown-menu` | Radix dropdown for settings |
| `m` | `framer-motion` | Animation for floating controls |

---

## Data Fetching

### Chapter Content

```ts
const response = await fetch(`/api/chapters/${chapterId}/content`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

The API route:
1. Verifies authentication
2. Checks chapter access (free, purchased, or subscribed)
3. Returns chapter HTML/markdown content
4. Applies watermarking for paid content (embeds user ID)

### Chapter Metadata + Novel Context

```ts
const response = await fetch(`/api/novels-chapter/${novelId}`);
```

Returns the full chapter list for the novel, enabling prev/next navigation and the chapter drawer.

### State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `chapter` | `NovelChapter \| null` | `null` | Current chapter data |
| `novelData` | `NovelData \| null` | `null` | Parent novel metadata |
| `allChapters` | `Chapter[]` | `[]` | All chapters for navigation |
| `loading` | `boolean` | `true` | Initial load state |
| `isLocked` | `boolean` | `false` | Whether chapter is behind paywall |
| `squareImageId` | `string` | `''` | Novel square image asset ID (for drawer) |
| `colorPalette` | `string[]` | `[]` | Novel color palette for theming |
| `hasNovelSubscription` | `boolean` | `false` | Whether user has active subscription |
| `isSaved` | `boolean` | `false` | Whether user has saved/hearted the chapter |
| `novelCoverUrl` | `string` | `''` | Resolved cover image URL |
| `showControls` | `boolean` | `true` | Whether floating controls are visible |
| `showDrawer` | `boolean` | `false` | Whether chapter drawer is open |
| `showSettings` | `boolean` | `false` | Whether settings dropdown is open |
| `showLoginModal` | `boolean` | `false` | Whether login modal is shown |
| `commentsOpen` | `boolean` | `false` | Whether comment drawer is open |
| `theme` | `keyof typeof THEMES` | `'night'` | Current color theme |
| `font` | `string` | `'arial'` | Current font family |
| `fontSize` | `number` | `18` | Current font size (px) |
| `lineHeight` | `number` | `1.8` | Current line height |
| `alignment` | `'left' \| 'center' \| 'justify'` | `'left'` | Text alignment |
| `textIndent` | `boolean` | `false` | Whether paragraph indent is enabled |

---

## Components

### ChapterHeader

**File:** `src/app/components/novels/ChapterHeader.tsx`

The top floating control bar (rendered inline in the viewer page, not as a separate component — the header elements are part of the page's top `m.div`).

| Element | Icon | Action |
|---------|------|--------|
| Back button | `ArrowLeft` (lucide) | Navigates back to novel detail page (`/novels/{abbreviation}`) |
| Chapter title pill | — | Floating centered pill showing current chapter title |
| Menu button | `Menu` (lucide) | Opens `ChapterDrawer` side panel |

---

### ChapterContent

**File:** `src/app/components/novels/ChapterContent.tsx`

Renders the chapter's HTML content with a processing pipeline.

```ts
interface ChapterContentProps {
  content: string;
  className?: string;
}
```

#### Content Processing Pipeline

The `processContent()` function transforms raw chapter content through these steps:

1. **Unescape characters:** `\[` → `[`, `\'` → `'`, `\"` → `"`, `\{` → `{`, `\}` → `}`, `\\` → `\`
2. **Scene break markers:** Unicode art string (`⋉◆⌌ ⫺⪼▫◆▫⪻⫹ ⌍◆⋊`) converted to `<hr />`
3. **Markdown formatting:** `**bold**` → `<strong>`, `*italic*` → `<em>`
4. **Paragraph wrapping:** Double newlines split into `<p>` tags, single newlines become `<br />`
5. **HTML preservation:** Existing `<div>` blocks are preserved and inner text content is processed separately

#### Output

Content is rendered into a div with class `chapter-content-html`:

```tsx
<div
  className={`chapter-content-html ${className}`}
  dangerouslySetInnerHTML={{ __html: processContent(content) }}
/>
```

The `chapter-content-html` class has extensive custom CSS rules (see [Custom CSS](#custom-css)).

#### Reader Settings Applied

The parent container applies reader settings via inline styles:

```tsx
<div style={{
  fontFamily: FONTS.find(f => f.value === font)?.family,
  fontSize: `${fontSize}px`,
  lineHeight: lineHeight,
  textAlign: alignment,
  textIndent: textIndent ? '1.5em' : '0',
}}>
```

---

### ChapterDrawer

**File:** `src/app/components/novels/ChapterDrawer.tsx`

A slide-in side panel for chapter navigation.

```ts
interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterId: number;
  novelId: string;
  novelTitle: string;
  novelBanner: string;
  totalChapters: number;
  squareImageId?: string;
  hasNovelSubscription: boolean;
  colorPalette?: string[];
  currentTheme?: { bg: string; text: string };
  onOpenUnlockModal?: (chapterId: number) => void;
  onRequireAuth?: () => void;
  isAuthenticated?: boolean;
}
```

| Feature | Details |
|---------|---------|
| **Animation** | Framer Motion `AnimatePresence`, slides in from right |
| **Header** | Square novel cover image + novel title |
| **Chapter List** | Scrollable list of all chapters |
| **Current Chapter** | Highlighted with accent color from `colorPalette[0]` (default: `#3b82f6`) |
| **Read Chapters** | Checkmark icon indicator |
| **Locked Chapters** | `Lock` icon + Helix cost display |
| **Unread Free** | No icon (default state) |
| **Click Behavior** | Free/unlocked → navigate to chapter. Locked → calls `onOpenUnlockModal` |
| **Theme Aware** | Uses `currentTheme` prop from reader settings, falls back to dark mode detection via `MutationObserver` |
| **Image Loading** | Fetches banner and square image URLs via `getAssetUrl` + `prefetchFileMetadata` |

---

### LockedChapterView

**File:** `src/app/components/novels/LockedChapterView.tsx`

Displayed when a user navigates to a chapter they don't have access to.

```ts
interface LockedChapterViewProps {
  helixCost: number;
  helix: number;
  novelId: string;
  novelAbbreviation: string;
  novelTitle: string;
  coverUrl: string;
  colorPalette?: string[] | string | null;
  hasNovelSubscription: boolean;
  chapterId: number;
  userId: string;
  onUnlock: () => void;
  onSubscriptionSuccess: () => void;
  requiredChapters?: RequiredChapter[];
  totalHelixCost?: number;
}
```

| Feature | Details |
|---------|---------|
| **Layout** | Centered lock icon, Helix cost display, action buttons |
| **Primary CTA** | "Unlock with Helix" — opens `ModalViewbox` with `helix-unlock` content |
| **Secondary CTA** | "Subscribe to Read All" — opens `ModalViewbox` with `novel-subscription` content (only if `hasNovelSubscription`) |
| **Sequential Warning** | If `requiredChapters` is non-empty, shows the list of prerequisite chapters that must be purchased first, with `totalHelixCost` |
| **Color** | Uses `colorPalette` (parsed from string/array/null) for accent styling, defaults to `#3b82f6` |
| **Icons** | `Lock` (lucide) for the lock display, `Crown` (lucide) for subscription CTA |

---

### LoadingStates

**File:** `src/app/components/novels/LoadingStates.tsx`

A wrapper component for chapter-specific loading and error states. Renders appropriate UI based on:
- Loading: Full-screen centered spinner/skeleton
- Error: Error message with retry option
- Not found: Chapter not found message

---

## Floating Controls

The viewer uses auto-hiding floating controls that appear at the top and bottom of the viewport.

### Auto-Hide Behavior

| Trigger | Viewport | Action |
|---------|----------|--------|
| Mouse move | Desktop (≥768px) | Show controls, start 3s hide timer |
| Tap (short touch, &lt;300ms, no movement) | Mobile | Toggle controls on/off |
| Scroll/swipe (touch move >10px) | Mobile | Does NOT toggle (prevents accidental triggers) |
| Page load | All | Controls visible, auto-hide after 3s |

Implementation uses `mousemove`, `touchstart`, `touchmove`, and `touchend` event listeners with:
- `hasMoved` flag to distinguish taps from scrolls
- `touchDuration` check (&lt;300ms) to ignore long presses
- Interactive element exclusion (buttons, menus, links, inputs)

### Animation

Framer Motion `m.div` with spring-based vertical slide:

```tsx
// Top controls
<m.div animate={{ y: showControls ? 0 : -100 }} transition={{ type: 'spring' }}>

// Bottom controls
<m.div animate={{ y: showControls ? 0 : 100 }} transition={{ type: 'spring' }}>
```

### Top Controls Bar

| Position | Element | Action |
|----------|---------|--------|
| Left | Back button (`ArrowLeft`) | Navigate to `/novels/{abbreviation}` |
| Center | Chapter title pill | Display only (floating centered) |
| Right | Menu button (`Menu`) | Open `ChapterDrawer` |

### Bottom Controls Bar

| Position | Element | Action |
|----------|---------|--------|
| Left | Heart/save button (`Heart`) | Toggle chapter save state |
| Left-center | Comments button (`MessageCircle`) | Open `CommentDrawer` and show chapter discussion |
| Center | Settings button (`Settings`) | Open reader settings dropdown |
| Right | Prev chapter (`ChevronLeft`) | Navigate to previous chapter |
| Right | Next chapter (`ChevronRight`) | Navigate to next chapter |

---

## Comments Integration

The chapter viewer embeds the comments feature directly rather than routing to a separate page.

### Integration Point

- **File:** `src/app/viewer/[chapterId]/page.tsx`
- **State:** `commentsOpen` (`boolean`)
- **Component:** `CommentDrawer`

```tsx
const [commentsOpen, setCommentsOpen] = useState(false);

<CommentDrawer
  open={commentsOpen}
  onOpenChange={setCommentsOpen}
  chapterId={chapterId}
  currentUserId={user?.id ?? null}
/>
```

### Behavior

- comments are visible from inside the immersive reader without leaving the chapter
- authenticated users can create comments, reply, vote, edit/delete their own comments, and report others
- unauthenticated users can still read the comment feed, but the composer area prompts them to sign in before interacting
- the drawer and chapter navigation systems stay separate so chapter browsing and discussion do not interfere with each other

### Supporting Components

| Component | Role |
|---|---|
| `CommentDrawer` | Bottom-sheet shell for chapter comments |
| `CommentFeed` | Fetches and renders the thread |
| `CommentInput` | Handles create/reply/edit flows |
| `CommentCard` | Renders each comment and nested replies |

For the full comments feature breakdown, see [13 — UI: Comments System](./13-UI-Comments-System.md).

---

## Reader Settings

All settings are persisted to `localStorage` under the key `chapter-viewer-settings` and restored on page load.

### Color Themes

```ts
const THEMES = {
  night:  { name: 'Night',  bg: '#000000', text: '#ffffff' },
  onyx:   { name: 'Onyx',   bg: '#1a1a1a', text: '#d1d5db' },
  dusk:   { name: 'Dusk',   bg: '#2c3e50', text: '#f5e6d3' },
  sepia:  { name: 'Sepia',  bg: '#f4ecd8', text: '#5c4033' },
  silver: { name: 'Silver', bg: '#e8e8e8', text: '#2d2d2d' },
  frost:  { name: 'Frost',  bg: '#ffffff', text: '#000000' },
};
```

| Theme | Background | Text | Feel |
|-------|-----------|------|------|
| Night | `#000000` (black) | `#ffffff` (white) | Pure dark |
| Onyx | `#1a1a1a` (near-black) | `#d1d5db` (light gray) | Soft dark |
| Dusk | `#2c3e50` (dark blue-gray) | `#f5e6d3` (warm cream) | Dark purple/blue |
| Sepia | `#f4ecd8` (warm beige) | `#5c4033` (brown) | Classic book feel |
| Silver | `#e8e8e8` (light gray) | `#2d2d2d` (dark gray) | Neutral light |
| Frost | `#ffffff` (white) | `#000000` (black) | Pure light |

### Font Families

```ts
const FONTS = [
  { value: 'arial',       label: 'Arial',         family: 'Arial, sans-serif' },
  { value: 'opensans',    label: 'Open Sans',      family: '"Open Sans", sans-serif' },
  { value: 'ptserif',     label: 'PT Serif',       family: '"PT Serif", serif' },
  { value: 'arbutusslab', label: 'Arbutus Slab',   family: '"Arbutus Slab", serif' },
  { value: 'roboto',      label: 'Roboto',         family: '"Roboto", sans-serif' },
  { value: 'opendyslexic',label: 'Open Dyslexic',  family: '"OpenDyslexic", sans-serif' },
];
```

### Other Settings

| Setting | Type | Range | Default | Control |
|---------|------|-------|---------|---------|
| Font Size | `number` | 12px – 32px | 18px | `Minus`/`Plus` buttons |
| Line Height | `number` | 1.2 – 3.0 | 1.8 | `Minus`/`Plus` buttons |
| Text Alignment | `string` | `left`, `center`, `justify` | `left` | `AlignLeft`/`AlignCenter`/`AlignJustify` icon buttons |
| Paragraph Indent | `boolean` | on/off | `false` | Toggle (applies `1.5em` text-indent) |

### Reset to Defaults

"Reset" button (`RotateCcw` icon) restores all settings to defaults:
- Theme: `night`
- Font: `arial`
- Font size: `18`
- Line height: `1.8`
- Alignment: `left`
- Text indent: `false`

Analytics event `trackReaderSettingsReset` is fired on reset.

### Settings Dropdown

Implemented with Radix UI `DropdownMenu` components:
- `DropdownMenuTrigger` on the Settings button
- `DropdownMenuContent` with labeled sections separated by `DropdownMenuSeparator`
- Each setting group has a `DropdownMenuLabel`

---

## Content Protection

Paid chapter content includes several layers of protection:

| Protection | Implementation | Purpose |
|-----------|---------------|---------|
| **User watermarking** | Server-side: user ID embedded into content | Trace content leaks to source |
| **Right-click prevention** | `NoRightClick` wrapper component | Prevents "Save As" and inspect context menu |
| **DevTools detection** | `DevtoolProtection` component | Detects open developer tools |
| **Authenticated access** | API route requires valid auth token | Prevents unauthenticated content access |

**Note:** Free chapters do not have watermarking or protection measures applied. Content protection only applies to paid/subscribed content.

---

## Custom CSS

**File:** `src/app/globals.css` (under `.chapter-content-html` scope)

### Colored Text Classes

| Class | Color | Effect |
|-------|-------|--------|
| `.red-text` | Red | Red text with red glow text-shadow |
| `.blue-text` | Blue | Blue text with blue glow text-shadow |
| `.gold-text` | Gold | Gold text with gold glow text-shadow |
| `.silver-text` | Silver | Silver text with silver glow text-shadow |

### Colored Box Classes

| Class | Style |
|-------|-------|
| `.red-box` | Red-bordered container with red-tinted background |
| `.blue-box` | Blue-bordered container with blue-tinted background |
| `.gold-box` | Gold-bordered container with gold-tinted background |
| `.silver-box` | Silver-bordered container with silver-tinted background |

### Title Separators

`::after` pseudo-elements on heading elements within chapter content, rendering gradient lines as visual section dividers.

### Game Prompt Styles

| Class | Purpose |
|-------|---------|
| `.game-prompt-silver-info` | Styled game notification boxes (used in LitRPG/GameLit content) — bordered panel with distinct background and typography |

### Custom Fonts

| Font | Type | Usage |
|------|------|-------|
| Quattrocento | Serif | Chapter titles, formal text |
| Amita | Cursive | Stylized dialogue or narration |
| MedievalSharp | Cursive | Fantasy-themed content, system messages |

### Content Formatting

- **Dialogue/narration/monologue:** Custom styling for quoted dialogue and internal monologue text
- **Scene breaks:** `<hr>` elements styled as centered decorative dividers
- **Paragraphs:** Consistent spacing and line-height within `.chapter-content-html`

---

## Access Control Decision Tree

```
User navigates to /viewer/{chapterId}
         │
         ▼
  Fetch chapter metadata
         │
         ▼
  Is chapter in the free range? ──YES──→ ✅ Show content (no watermark)
         │
         NO
         │
         ▼
  Is user authenticated? ──NO──→ 🔒 Show LockedChapterView
         │                            (with login prompt)
        YES
         │
         ▼
  Has user purchased this chapter? ──YES──→ ✅ Show content (watermarked)
         │
         NO
         │
         ▼
  Has user active subscription? ──YES──→ ✅ Show content (watermarked)
         │
         NO
         │
         ▼
  🔒 Show LockedChapterView
     ├── "Unlock with Helix" → ModalViewbox (helix-unlock)
     └── "Subscribe to Read All" → ModalViewbox (novel-subscription)
```

The `isLocked` state is determined after fetching chapter data. When locked:
- `LockedChapterView` replaces the content area
- The locked view checks for sequential unlock requirements (`requiredChapters`)
- Successful unlock refreshes chapter data and transitions to content view

---

## Loading States

### LoadingStates Component

**File:** `src/app/components/novels/LoadingStates.tsx`

Full-screen loading state that matches the reader's current theme colors. Renders a centered spinner/skeleton while chapter data is being fetched.

### Loading Sequence

```
1. Page mounts, chapterId extracted from URL params
2. Auth state checked (authLoading → resolved)
3. Chapter metadata fetched → determines if locked or accessible
4. If locked → LockedChapterView rendered immediately
5. If accessible → chapter content fetched → ChapterContent rendered
6. Novel context (chapter list) fetched → drawer + navigation enabled
7. Reader settings loaded from localStorage
8. Image URLs resolved for drawer cover art
9. Controls auto-hide after 3s
```

---

## Cross-References

- **[06 — Payment & Subscription System](./06-Payment-Subscription-System.md):** Helix unlock flow via `ModalViewboxContext`, subscription checkout via Stripe, wallet operations via `useWallet`.
- **[08 — State Management](./08-State-Management.md):** `useAuth` context, `useToast` context, `useModalViewbox` context, `useWallet` hook, localStorage patterns for reader settings.
- **[11 — UI: Novel Detail](./11-UI-Novel-Detail.md):** The novel detail page that links to the viewer, chapter access logic shared between both pages, back navigation target.
- **[13 — UI: Comments System](./13-UI-Comments-System.md):** Comments drawer architecture, API routes, voting, replies, reports, and moderation state.
- **[16 — UI: Common Components](./16-UI-Common-Components.md):** Shared modal, drawer, toast, and auth-login interaction patterns used by the viewer.
- **[17 — UI: Styling System](./17-UI-Styling-System.md):** Reader typography, skeleton states, global interaction styling, and chapter content CSS.
