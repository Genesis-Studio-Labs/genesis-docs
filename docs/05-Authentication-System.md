---
id: "05-Authentication-System"
slug: "/05-Authentication-System"
sidebar_position: 5
sidebar_label: "Authentication System"
---

# 05 — Authentication System

> Genesis Studio authentication architecture, flows, and API protection patterns.

---

## Table of Contents

- [Architecture](#architecture)
- [Supabase Auth Configuration](#supabase-auth-configuration)
- [Middleware](#middleware)
- [AuthContext](#authcontext)
- [Auth Flows](#auth-flows)
- [LoginModal](#loginmodal)
- [API Route Protection Pattern](#api-route-protection-pattern)
- [Cross-References](#cross-references)

---

## Architecture

Genesis Studio uses **Supabase Auth** with cookie-based sessions managed by `@supabase/ssr` (v0.7.0). Authentication supports three strategies:

| Strategy | Provider | Notes |
|----------|----------|-------|
| Email/Password | Supabase Auth | Standard credentials flow |
| Google OAuth | Google | Redirect-based, returns to `/auth/callback` |
| Discord OAuth | Discord | Redirect-based, returns to `/auth/callback` |

Sessions are stored in **HTTP cookies** and automatically refreshed by the middleware on every request. After authentication, user profiles are fetched from Directus CMS and cached client-side.

---

## Supabase Auth Configuration

### Browser Client

**File:** `src/lib/supabase.ts`

Creates a browser-side Supabase client for use in React components:

```ts
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

- Used by `AuthContext`, client-side hooks, and any component that needs direct Supabase access.
- Reads/writes session cookies automatically via the browser.

### Server Client

**File:** `src/lib/supabase-server.ts`

Creates a server-side Supabase client with explicit cookie handling for API routes:

```ts
import { createServerClient } from "@supabase/ssr";

// Server client with cookie get/set/remove handlers
const supabase = createServerClient(
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      get(name) { /* read from request cookies */ },
      set(name, value, options) { /* write to response cookies */ },
      remove(name, options) { /* delete from response cookies */ },
    },
  }
);
```

- Used in API routes and server components that need authenticated access.
- Cookie handlers bridge between the Next.js request/response cycle and Supabase's session management.

### OAuth Providers

Both Google and Discord OAuth are configured to redirect back to the same callback endpoint:

```
Redirect URL: /auth/callback
```

Provider configuration lives in the Supabase dashboard. The client-side code triggers OAuth via `supabase.auth.signInWithOAuth()`.

---

## Middleware

**File:** `src/proxy.ts`

The middleware runs on **every request** except static assets and performs two critical functions: session refresh and CORS handling.

### Execution Flow

1. Create a server Supabase client with cookie `get`, `set`, and `remove` handlers bound to the incoming request/response.
2. Call `supabase.auth.getUser()` — this refreshes expired sessions transparently by validating the current JWT and issuing a new one if needed.
3. For `/api/*` routes, add CORS headers:
   - `Access-Control-Allow-Origin: *`
   - Standard CORS preflight headers for methods, headers, and credentials.
4. Return the response with any updated session cookies.

### Matcher Configuration

The middleware matcher excludes paths that don't need session handling:

```ts
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Image file extensions (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
  ],
};
```

### Why `getUser()` in Middleware?

Calling `getUser()` on every request ensures that:

- Expired JWTs are refreshed before they reach page components or API routes.
- The session cookie is always up-to-date.
- Server components and API routes can trust the session without additional refresh logic.

---

## AuthContext

**File:** `src/app/context/AuthContext.tsx`

The `AuthContext` is the primary client-side authentication state manager. It wraps the entire application and provides authentication state and methods to all components.

### State

| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Current authenticated user or null |
| `isAuthenticated` | `boolean` | Whether a user is currently logged in |
| `isLoading` | `boolean` | True during initial auth check and profile loading |

The `User` object contains:

```ts
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  profile: Partial<UserProfile>;
}
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `login` | `(email: string, password: string) => Promise<void>` | Email/password sign in |
| `signup` | `(email: string, password: string) => Promise<void>` | Create new account |
| `signInWithGoogle` | `() => Promise<void>` | Initiate Google OAuth |
| `signInWithDiscord` | `() => Promise<void>` | Initiate Discord OAuth |
| `logout` | `() => Promise<void>` | Sign out and clear session |
| `fetchUserProfile` | `() => Promise<void>` | Fetch/refresh profile from Directus |
| `resetPassword` | `(email: string) => Promise<void>` | Send password reset email |
| `requireAuth` | `(callback?: () => void) => void` | Guard — opens login modal if not authenticated, executes callback if authenticated |

### Profile Loading

After successful authentication, the context fetches the user's profile from Directus:

```
GET /api/directus/user-profile/[id]
```

Profile loading uses a **module-level cache** with the following characteristics:

- **TTL:** 5 minutes — cached profiles are reused within this window.
- **Deduplication:** In-flight requests for the same user ID are deduplicated. If a profile fetch is already in progress, subsequent calls await the same promise instead of issuing new requests.
- **Scope:** The cache exists at the module level (outside the React component tree), so it persists across re-renders but not across page reloads.

### Auth State Listener

The context sets up a Supabase auth state listener on mount:

```ts
supabase.auth.onAuthStateChange((event, session) => {
  // Handle SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
  // Update user state and fetch profile when session changes
});
```

This listener reacts to:

- Initial session restoration from cookies
- Sign in / sign out events
- Token refresh events
- OAuth callback completions

### Hook

```ts
const { user, isAuthenticated, login, logout, ... } = useAuth();
```

`useAuth()` **throws an error** if called outside of an `<AuthProvider>`. This ensures components that depend on auth state are always properly wrapped.

---

## Auth Flows

### Email/Password Sign In

```
User enters credentials
  → supabase.auth.signInWithPassword({ email, password })
  → Session stored in cookies (handled by @supabase/ssr)
  → AuthContext updates user state
  → Profile fetched from Directus (/api/directus/user-profile/[id])
  → UI updates to authenticated state
```

### Email/Password Sign Up

```
User enters credentials
  → supabase.auth.signUp({ email, password })
  → Session stored in cookies
  → AuthContext updates user state
  → Profile fetched from Directus
  → UI updates to authenticated state
```

### OAuth Flow (Google / Discord)

```
User clicks "Sign in with Google/Discord"
  → Store current URL in localStorage as auth_redirect_url
  → supabase.auth.signInWithOAuth({
      provider: 'google' | 'discord',
      options: { redirectTo: '/auth/callback' }
    })
  → Browser redirects to provider's consent screen
  → User authorizes
  → Provider redirects back to /auth/callback with authorization code
```

### Auth Callback

**File:** `src/app/(auth)/auth/callback/page.tsx`

The callback page handles the return from OAuth providers and password reset links:

1. Extract the `code` query parameter from the URL.
2. Exchange the code for a session: `supabase.auth.exchangeCodeForSession(code)`.
3. Check for `reset=true` query parameter:
   - If present: redirect to `/auth/update-password` (password recovery flow).
   - If absent: read `auth_redirect_url` from `localStorage` and redirect there (or fallback to homepage).

### Password Reset Flow

```
User clicks "Forgot Password"
  → User enters email address
  → supabase.auth.resetPasswordForEmail(email, {
      redirectTo: '/auth/callback?reset=true'
    })
  → Supabase sends reset email
  → User clicks link in email
  → Browser opens /auth/callback?reset=true&code=...
  → Callback exchanges code for session
  → Detects reset=true, redirects to /auth/update-password
```

### Update Password

**File:** `src/app/(auth)/auth/update-password/page.tsx`

The password update page provides:

- Two input fields: new password and confirm password.
- Validation: minimum 6 characters, passwords must match.
- On submit: `supabase.auth.updateUser({ password })`.
- Success: redirect to homepage with authenticated session.

---

## LoginModal

**File:** `src/app/components/auth/LoginModal.tsx`

The `LoginModal` is a full-screen animated modal powered by **Framer Motion** that handles all authentication UI.

### Features

- **Full-screen overlay** with entrance/exit animations.
- **Sign In / Sign Up toggle** — switches between login and registration forms.
- **Email/password fields** with client-side validation (required fields, email format).
- **OAuth buttons** — "Continue with Google" and "Continue with Discord".
- **"Forgot Password" flow** — inline email input that triggers `resetPassword()`.
- **Redirect handling** — stores the current URL in `localStorage` before initiating OAuth so the user returns to where they left off.

### Flow

```
Modal opens (triggered by requireAuth() or direct open)
  → User chooses auth method:
    a) Email/password → login() or signup() → success → close modal → redirect
    b) OAuth → store redirect URL → signInWithGoogle/Discord() → browser redirect
    c) Forgot password → enter email → resetPassword() → confirmation message
```

On success, the modal closes and navigates to the stored redirect URL if one exists.

---

## API Route Protection Pattern

### Standard Pattern

API routes that require authentication follow this pattern:

```ts
import { createSupabaseServer } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const supabase = createSupabaseServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  // Proceed with authenticated logic using user.id, user.email, etc.
}
```

### Auth Utilities

**File:** `src/lib/auth-utils.ts`

| Helper | Purpose |
|--------|---------|
| `extractUserData(session \| user)` | Normalizes user data from either a Supabase session object or a user object into a consistent shape. Handles both `session.user` and direct user objects. |
| `createSafeSessionHandler()` | Creates a wrapper for safe session access that handles edge cases like expired sessions, missing cookies, and race conditions during sign-out. |

### Protection Levels

| Level | Pattern | Use Case |
|-------|---------|----------|
| Public | No auth check | Content listings, public novel data |
| Authenticated | `getUser()` check | Profile access, bookmarks, wallet |
| Owner-only | `getUser()` + ID match | Updating own profile, own purchases |

### Comments-Specific Auth Rules

The comments system mixes public reading with authenticated actions:

| Action | Auth Required | Notes |
|---|---|---|
| Read comments | No | Public readers can open the comments drawer and view discussion threads |
| Post comment | Yes | `POST /api/comments` requires a valid Supabase session |
| Reply to comment | Yes | Same endpoint as create, with `parentComment` set |
| Edit own comment | Yes | `PATCH /api/comments/[commentId]`, owner-only |
| Delete own comment | Yes | `DELETE /api/comments/[commentId]`, owner-only soft delete |
| Vote on comment | Yes | `POST /api/comments/[commentId]/vote` |
| Report comment | Yes | `POST /api/comments/[commentId]/report`; self-reporting is blocked |

---

## Cross-References

- **[01 — Architecture Overview](./01-Architecture-Overview.md):** Overall system architecture and technology stack.
- **[03 — Directus CMS Integration](./03-Directus-CMS-Integration.md):** Directus-backed profile data and content boundaries.
- **[04 — API Reference](./04-API-Reference.md):** Auth-protected routes, including comments, wallet, profile, and subscription APIs.
- **[13 — UI: Comments System](./13-UI-Comments-System.md):** How auth gates comment posting, voting, editing, deleting, and reporting.
- **[19 — Scripts & Development Setup](./19-Scripts-Development-Setup.md):** Environment variables and local auth configuration.
