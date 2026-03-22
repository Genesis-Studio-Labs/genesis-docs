---
id: "13-UI-Comments-System"
slug: "/13-UI-Comments-System"
sidebar_position: 13
sidebar_label: "UI: Comments System"
---

# 13 — UI: Comments System

> The comments system is a chapter-level discussion feature embedded directly inside the reader. It combines a dedicated React context, React Query data hooks, a small REST API surface under `/api/comments`, and Supabase-backed tables for comments, votes, and moderation reports.

---

## Table of Contents

- [Overview](#overview)
- [Where The Feature Lives](#where-the-feature-lives)
- [Architecture](#architecture)
- [Viewer Integration](#viewer-integration)
- [Component Tree](#component-tree)
- [Context Model](#context-model)
- [Data Fetching And Mutations](#data-fetching-and-mutations)
- [API Surface](#api-surface)
- [Database Model](#database-model)
- [User Flows](#user-flows)
- [UI States](#ui-states)
- [Caching And Realtime Behavior](#caching-and-realtime-behavior)
- [Moderation And Safety](#moderation-and-safety)
- [Cross-References](#cross-references)

---

## Overview

The comments subsystem is designed as a self-contained reader feature:

- **Entry point:** `src/app/viewer/[chapterId]/page.tsx`
- **Primary UI shell:** `src/app/components/comments/CommentDrawer.tsx`
- **Shared feature state:** `src/app/components/comments/context/CommentSectionContext.tsx`
- **Data layer:** `src/hooks/queries/useComments.ts`
- **Backend:** `src/app/api/comments/`
- **Storage:** Supabase tables `comments`, `upvotes`, and `comment_reports`
- **Author display metadata:** Directus `user_profiles`

The system supports:

- top-level comments and threaded replies
- upvotes and downvotes
- editing and soft deletion by the comment owner
- moderation reports
- realtime-ish polling for fresh comment feeds
- authenticated and unauthenticated reader states

---

## Where The Feature Lives

### Core source files

| Layer | File | Role |
|---|---|---|
| Types | `src/types/comments.ts` | Shared `Comment`, payload, and response interfaces |
| Query hooks | `src/hooks/queries/useComments.ts` | Fetches comments and wraps all mutations |
| Query keys | `src/lib/queryClient.ts` | Defines `queryKeys.comments.*` |
| Cache profile | `src/lib/api-utils.ts` | Maps comments endpoints to `realtime` caching |
| Context | `src/app/components/comments/context/CommentSectionContext.tsx` | Shared sort/reply/edit/focus state |
| UI shell | `src/app/components/comments/CommentDrawer.tsx` | Bottom-sheet comments UI in the reader |
| Feed | `src/app/components/comments/CommentFeed.tsx` | List, polling, pagination, empty/error states |
| Composer | `src/app/components/comments/CommentInput.tsx` | Create/edit/reply textarea |
| Item | `src/app/components/comments/CommentCard.tsx` | Individual comment card + nested replies |
| API | `src/app/api/comments/` | CRUD, vote, replies, report endpoints |

### Supporting files

| File | Purpose |
|---|---|
| `src/app/components/comments/CommentSection.tsx` | Inline/desktop variant of the comments feature |
| `src/app/components/comments/CommentVoteButtons.tsx` | Voting controls |
| `src/app/components/comments/CommentActionMenu.tsx` | Edit / delete / report actions |
| `src/app/components/comments/CommentReplyButton.tsx` | Sets reply target and focuses input |
| `src/app/components/comments/CommentSortButton.tsx` | Sort selector (`top`, `new`, `old`) |
| `src/app/components/comments/CommentSkeleton.tsx` | Loading placeholder |
| `src/app/components/comments/utils/comment-helpers.ts` | Formatting and utility helpers |

---

## Architecture

```text
Reader Page
  -> CommentDrawer / CommentSection
    -> CommentSectionContext
      -> React Query hooks (useComments, useCommentReplies, mutations)
        -> /api/comments/* route handlers
          -> Supabase tables (comments, upvotes, comment_reports)
          -> Directus user_profiles lookup
```

### Why this split exists

- **Supabase** stores mutable reader-generated data: comments, votes, reports.
- **Directus** stores author-facing profile metadata: username, avatar, staff/supporter flags.
- **React Query** handles polling, caching, invalidation, and mutation state.
- **CommentSectionContext** coordinates local UI state that is too interactive for plain query hooks alone.

---

## Viewer Integration

**Integration file:** `src/app/viewer/[chapterId]/page.tsx`

The chapter viewer owns the comments drawer state:

```tsx
const [commentsOpen, setCommentsOpen] = useState(false);

<CommentDrawer
  open={commentsOpen}
  onOpenChange={setCommentsOpen}
  chapterId={chapterId}
  currentUserId={userId}
/>
```

### Reader controls integration

- the floating bottom control cluster includes a **comments button**
- tapping it opens `CommentDrawer`
- the drawer is independent of the chapter navigation drawer
- comments are available from inside the immersive reader without leaving the page

### Auth behavior in the viewer

- authenticated readers can comment, vote, edit/delete their own comments, and report others
- unauthenticated readers can still open and read comments
- the composer area switches to a login prompt when no user session is present

---

## Component Tree

```text
CommentDrawer / CommentSection
  -> CommentSectionProvider
    -> CommentFeed
      -> CommentSortButton
      -> CommentCard
        -> CommentVoteButtons
        -> CommentReplyButton
        -> CommentActionMenu
        -> CommentCard (recursive for replies)
    -> CommentInput
```

### `CommentDrawer`

**File:** `src/app/components/comments/CommentDrawer.tsx`

Props:

```ts
{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  currentUserId: string | null;
}
```

Role:

- renders the feature inside a drawer/bottom-sheet shell
- wraps feed and composer in `CommentSectionProvider`
- acts as the mobile-first reader integration point

### `CommentSection`

**File:** `src/app/components/comments/CommentSection.tsx`

Inline variant of the same feature, suitable for non-drawer layouts.

### `CommentFeed`

**File:** `src/app/components/comments/CommentFeed.tsx`

Responsibilities:

- fetch paginated top-level comments via `useComments`
- reset page when sort changes
- poll every 15 seconds
- render loading, empty, error, and data states
- render `CommentCard` recursively for threaded replies

### `CommentCard`

**File:** `src/app/components/comments/CommentCard.tsx`

Props:

```ts
{
  comment: Comment;
  isReply?: boolean;
}
```

Responsibilities:

- render author avatar, username, badges, timestamp, edited state
- render score and action controls
- render reply nesting
- optionally fetch additional replies via `useCommentReplies`

### `CommentInput`

**File:** `src/app/components/comments/CommentInput.tsx`

Responsibilities:

- create new top-level comments
- create replies
- edit existing comments
- auto-focus when reply/edit is initiated elsewhere
- enforce the 2000-character limit in the UI

### Action/utility components

| Component | File | Purpose |
|---|---|---|
| `CommentVoteButtons` | `src/app/components/comments/CommentVoteButtons.tsx` | Upvote/downvote and score display |
| `CommentReplyButton` | `src/app/components/comments/CommentReplyButton.tsx` | Sets reply target and focuses input |
| `CommentActionMenu` | `src/app/components/comments/CommentActionMenu.tsx` | Edit/delete/report menu |
| `CommentSortButton` | `src/app/components/comments/CommentSortButton.tsx` | Sort selection |
| `CommentSkeleton` | `src/app/components/comments/CommentSkeleton.tsx` | Loading placeholder cards |

---

## Context Model

**File:** `src/app/components/comments/context/CommentSectionContext.tsx`

The context carries feature-local shared state that multiple comment components need simultaneously.

### Context values

| Key | Type | Purpose |
|---|---|---|
| `chapterId` | `string` | Current chapter identifier |
| `currentUserId` | `string | null` | Authenticated user ID |
| `sort` | `CommentSort` | Current feed sort mode |
| `setSort` | function | Changes sort and resets feed pagination |
| `replyTarget` | `Comment | null` | Comment currently being replied to |
| `setReplyTarget` | function | Sets reply mode |
| `clearReply` | function | Clears reply mode |
| `editTarget` | `Comment | null` | Comment currently being edited |
| `setEditTarget` | function | Sets edit mode |
| `clearEdit` | function | Clears edit mode |
| `isInputFocused` | `boolean` | Signals the composer to focus itself |
| `setIsInputFocused` | function | Triggers composer focus |

### Why context is used here

- reply and edit state must be triggered from deep child components (`CommentReplyButton`, `CommentActionMenu`)
- the composer (`CommentInput`) must react to those actions centrally
- sort changes affect feed paging and invalidation behavior

---

## Data Fetching And Mutations

**File:** `src/hooks/queries/useComments.ts`

### Query hooks

| Hook | Purpose | Query Key |
|---|---|---|
| `useComments(chapterId, sort, page, options?)` | Fetch paginated chapter comments | `['comments', 'chapter', chapterId, sort-page]` |
| `useCommentReplies(commentId, page, options?)` | Fetch paginated replies for a parent comment | `['comments', 'replies', commentId]` |

### Mutation hooks

| Hook | API target | Invalidation |
|---|---|---|
| `useCreateComment(chapterId, sort)` | `POST /api/comments` | invalidates chapter comments |
| `useEditComment(chapterId, sort)` | `PATCH /api/comments/[commentId]` | invalidates chapter comments |
| `useDeleteComment(chapterId, sort)` | `DELETE /api/comments/[commentId]` | invalidates chapter comments |
| `useVoteComment(chapterId, sort)` | `POST /api/comments/[commentId]/vote` | invalidates chapter comments |
| `useReportComment()` | `POST /api/comments/[commentId]/report` | no feed invalidation required |

### Auth handling in the hooks layer

`getAuthHeaders()` dynamically loads Supabase session state and injects:

```ts
{ Authorization: `Bearer ${accessToken}` }
```

This allows the same hooks to work in:

- authenticated mode for mutations and user vote state
- unauthenticated mode for public comment reading

---

## API Surface

All endpoints live under `src/app/api/comments/`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/comments` | Fetch paginated top-level comments with first replies |
| `POST` | `/api/comments` | Create a top-level comment or reply |
| `PATCH` | `/api/comments/[commentId]` | Edit an existing owned comment |
| `DELETE` | `/api/comments/[commentId]` | Soft-delete an owned comment |
| `POST` | `/api/comments/[commentId]/vote` | Add, remove, or switch vote |
| `GET` | `/api/comments/[commentId]/replies` | Fetch paginated replies |
| `POST` | `/api/comments/[commentId]/report` | Submit a moderation report |

### Response shaping highlights

- top-level comments come back enriched with:
  - nested first replies
  - `reply_count`
  - `user_profile` from Directus
  - `user_vote` for the current viewer when authenticated
- replies endpoint returns chronological reply pages
- delete is soft-delete, not hard-delete

For full request/response details, see [04 — API Reference](./04-API-Reference.md).

---

## Database Model

### `comments`

Core comment records with threaded reply support.

Important fields referenced in code:

- `id`
- `content`
- `processed_content`
- `upvotes`
- `downvotes`
- `created_at`
- `edited_at`
- `deleted_by_user`
- `deleted_by_mod`
- `user_id`
- `chapter_id`
- `parent_comment`

### `upvotes`

Stores one row per user/comment vote with a `vote_type` of `up` or `down`.

### `comment_reports`

Stores moderation reports with:

- reporter ID
- reported user ID
- comment ID
- reason
- optional additional text

### `user_profiles` (Directus)

Comment display metadata is joined from Directus rather than duplicated into the comment row itself.

Fields used by the UI:

- `id`
- `username`
- `profile_picture`
- `is_staff`
- `supporter`

For schema details, see [02 — Database Schema](./02-Database-Schema.md).

---

## User Flows

### Read comments

1. reader opens the comments button in the chapter viewer
2. `CommentDrawer` mounts the provider, feed, and input
3. `useComments` fetches the current chapter's top-level comments
4. the feed polls every 15 seconds while open

### Post a top-level comment

1. authenticated user types into `CommentInput`
2. submit triggers `useCreateComment`
3. API inserts a new row into `comments`
4. React Query invalidates the chapter comments feed
5. feed refetches and shows the new item

### Reply to a comment

1. user clicks `CommentReplyButton`
2. context sets `replyTarget` and requests input focus
3. `CommentInput` enters reply mode
4. submit sends `parentComment`
5. feed refetches and reply appears under the parent comment

### Edit a comment

1. owner opens `CommentActionMenu`
2. chooses edit
3. context sets `editTarget`
4. composer prefills with the old text
5. submit calls `PATCH /api/comments/[commentId]`

### Delete a comment

1. owner opens `CommentActionMenu`
2. confirms deletion
3. `DELETE /api/comments/[commentId]` sets `deleted_by_user = true`
4. feed refetches without hard-deleting the row

### Vote on a comment

1. authenticated user clicks upvote or downvote
2. vote mutation hits `/vote`
3. backend toggles, removes, or switches the vote
4. counters refresh after invalidation

### Report a comment

1. non-owner opens action menu
2. chooses report and selects a reason
3. backend rejects duplicate reports or self-reports
4. report is stored in `comment_reports`

---

## UI States

### Loading

- `CommentFeed` shows `CommentSkeleton`
- replies can load lazily under a parent comment

### Empty

- shown when no comments exist for the chapter
- includes a friendly first-comment prompt

### Error

- feed shows retry UI when fetch fails
- mutations expose disabled/loading states on action buttons

### Auth-gated composer

- unauthenticated users can read comments
- composer area switches to a login prompt instead of the textarea

### Editing and replying

- composer shows a state banner for reply/edit mode
- a cancel action clears the relevant context state

---

## Caching And Realtime Behavior

### API cache profile

Comments endpoints use the `realtime` cache profile from `src/lib/api-utils.ts`:

```text
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
```

### React Query timing

- comments feed stale time is short relative to CMS content
- `CommentFeed` additionally uses `refetchInterval: 15000`
- replies have their own query with a slightly longer freshness window

### Invalidation strategy

Mutations invalidate the chapter comment list rather than trying to manually patch every nested state branch. This keeps reply counts, vote state, and author metadata aligned with server truth.

---

## Moderation And Safety

- reports are stored separately in `comment_reports`
- self-reporting is blocked in the API
- duplicate reports by the same user are blocked
- comment deletion is soft-delete based
- helper utilities include lightweight sanitization and plain-text extraction helpers
- author badges such as staff/supporter are display-only and sourced from Directus profiles

---

## Cross-References

| Document | Why it matters |
|---|---|
| [02 — Database Schema](./02-Database-Schema.md) | Full table-level details for `comments`, `upvotes`, and `comment_reports` |
| [04 — API Reference](./04-API-Reference.md) | Exact request/response documentation for `/api/comments/*` |
| [08 — State Management](./08-State-Management.md) | Query keys, hooks, and context interaction patterns |
| [12 — UI: Chapter Viewer](./12-UI-Chapter-Viewer.md) | Where comments are launched from in the reading experience |
| [16 — UI: Common Components](./16-UI-Common-Components.md) | Drawer/modal/shared UI conventions used by the comments experience |
| [17 — UI: Styling System](./17-UI-Styling-System.md) | Skeleton loading and global interaction styling patterns |
