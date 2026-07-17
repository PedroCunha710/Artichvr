# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Spotify Album Finder — a static, front-end-only web app to search an artist and browse their full discography via the Spotify Web API. Portfolio project: the priority is clean, readable, well-documented vanilla JS, not framework tricks.

## Stack

- HTML5 / CSS3 / JavaScript ES6+ (no framework, no bundler, no build step)
- Native ES modules (`<script type="module">`) — import/export between files in `js/`
- [GSAP](https://gsap.com/) for animation, loaded via CDN `<script>` tag (classic, not a module) before `app.js` — `window.gsap` is used as a global inside `ui.js`, no import statement. Chosen over more CSS `@keyframes` because it can orchestrate sequences (tonearm-drop-then-spin, staggered card entrances) that plain CSS animations handle awkwardly.
- Spotify Web API (Search, Artists, Albums endpoints)
- No backend/server component

## Structure

```
index.html
css/style.css      # dark theme by default, Spotify green accents (#121212 / #1db954), light theme via `[data-theme="light"]`
js/api.js          # all Spotify API calls (app-level + user-level), auth token handling
js/auth.js         # user login: PKCE Authorization Code flow, token storage/refresh
js/history.js      # recent-searches list, persisted to localStorage
js/mock.js         # dev-only fixture data + mock-mode toggle, see "Mock mode" below
js/ui.js           # DOM rendering, no fetch calls here
js/app.js          # entry point, wires ui.js events to api.js/auth.js calls
js/config.js       # gitignored — real credentials, created from config.example.js
js/config.example.js
assets/
```

Keep the `api.js` / `ui.js` / `app.js` separation: API/network code never touches the DOM, rendering code never calls `fetch`.

## Auth

Two separate flows, for two separate purposes:

- **Client Credentials** (`js/api.js`, `getAccessToken`) — app-level token for public catalog reads (search, artist albums). Called directly from the browser: there is no backend, so the Client Secret is bundled into front-end JS and technically exposed. Deliberate trade-off, acceptable for read-only public data with no user login; would need a server-side token proxy for anything with real secrets.
- **Authorization Code + PKCE** (`js/auth.js`) — user login, needed for anything done *as* the user (currently: saving/removing albums in their library, scopes `user-library-modify`/`user-library-read`). PKCE needs no client secret, so it's safe as a pure-frontend flow. Access + refresh tokens are kept in `localStorage`; the redirect URI is computed at runtime (`location.origin + location.pathname`) and must exactly match one registered in the Spotify dashboard, so the app must be opened at that exact URL (trailing slash included) for login to work.

Credentials live in `js/config.js`, which is gitignored. `js/config.example.js` is the template committed to the repo.

Spotify's February 2026 Dev Mode changes removed the old content-specific library endpoints (`PUT`/`DELETE /me/albums`, `GET /me/albums/contains`) — they now 403 unconditionally regardless of scope. `js/api.js` uses the replacement generic endpoint (`/me/library`, `/me/library/contains`), which is keyed by full Spotify URI (`spotify:album:{id}`) rather than a bare ID; see `albumUri()`.

## Animation

Split deliberately between GSAP and plain CSS, not converted wholesale:

- **GSAP** (in `ui.js`) handles anything sequenced or JS-triggered: the one-time page-load intro (logo spin-in, cascading header/hero/footer reveal, then a continuous slow ambient spin on the small header logo), the hero background photo carousel (crossfade every ~4s), the loader's tonearm-drop-then-spin timeline, the error state's needle jitter, the hero's collapse-on-first-search, staggered entrance of the artist card and album grid, and the save-button "pop" on click.
- **CSS** still handles simple, always-on hover/focus states (buttons, pills, card lift on hover) — GSAP would add no value there and just be more code to read.

Pivot points for the SVG loader/error icons (tonearm, vinyl disc, error needle) are set via GSAP's `svgOrigin` option, passed directly in the `gsap.set`/`.to()` calls — not CSS `transform-origin`. GSAP resolves a CSS `transform-origin` in `px` against the rotating element's own local bounding box rather than the SVG's `viewBox` space, which sends small/off-center groups (e.g. the vinyl's off-axis label dot) spinning around the wrong point; `svgOrigin` pins it to the correct point in `viewBox` coordinates.

## Hero background photos

`.hero-bg-slide` divs in `index.html` hotlink directly to Wikimedia Commons image URLs (CC BY 2.0, not CC0 — attribution is required and lives in the footer's `.photo-credits` line; don't remove it if you swap photos, or update it to match). No API key or backend needed since these are just `background-image` on plain `<div>`s. `.hero-bg`/`.hero-overlay` are `position: fixed` covering the full viewport (not just the `.hero` section) so the photo shows through `main`/the footer too, since neither has its own background color — only the `.site-header` bar stays opaque on top of it. `.hero-overlay` is the dark gradient that keeps text readable regardless of which photo is showing; `collapseHero()` fades the whole background+overlay out once results appear, rather than trying to show a cropped sliver of it behind the compact search bar. `.hero-title`/`.hero-subtitle` are hardcoded to light colors rather than `var(--text)`/`var(--text-muted)` — they always sit on the dark photo overlay regardless of the light/dark theme toggle, so tying them to the theme vars would make them unreadable in light mode.

## Theme

Colors live as CSS custom properties on `:root` (dark, the default) with overrides under `:root[data-theme="light"]` — `css/style.css` §1. The `data-theme` attribute is set on `<html>`, not `<body>`, so it's available before the rest of the DOM parses. An inline, non-module `<script>` in `index.html`'s `<head>` (before the stylesheet `<link>`) reads `localStorage.artichvr_theme`, falling back to `prefers-color-scheme`, and sets the attribute synchronously — this has to run before first paint to avoid a flash of the wrong theme, which a deferred `type="module"` script can't guarantee. The toggle button's click handler (in `ui.js`) just flips the attribute and re-persists it; it duplicates the storage key rather than importing it from a shared module, since the inline head script can't import anything.

The SVG turntable/vinyl icons (header logo, loader, error state) keep their hardcoded dark fills in both themes — they're meant to look like an actual black vinyl record, not UI chrome that should invert.

## Mock mode

Spotify's Development Mode rate limit is easy to burn through while iterating on UI (filters, theme, save flow), and once tripped it can block real catalog reads for hours. `js/mock.js` provides a bypass: open the app with `?mock=1` in the URL (persists in `localStorage.artichvr_mock` until you visit with `?mock=0`) to route `api.js`'s functions to fixture data instead of `fetch`, and `auth.js`'s login/logout to a fake session (`isMockLoggedIn`/`setMockLoggedIn`) instead of the real PKCE flow — the whole app (search, filters, decades, save/toast, history) becomes testable offline, no Spotify calls at all. A red "Mock data" badge (`ui.js`, `.mock-badge`) stays on screen the whole time so mock output is never mistaken for a real search result. Extend `MOCK_ALBUMS`/`MOCK_SUGGESTIONS` in `mock.js` if a feature needs different fixture data to exercise.

## Running locally

Needs to be served over HTTP (ES modules and the Spotify token request don't work over `file://`). Any static server works, e.g. `npx serve` or VS Code's Live Server.

## Conventions

- No comments unless the code hides a non-obvious reason (e.g. the auth trade-off above).
- Escape any text interpolated from the Spotify API into HTML templates (artist/album names) before rendering — don't assume API data is safe to inject raw.
- All user-facing strings and docs are in English.

## Roadmap (not yet built)

Nothing outstanding right now. Sort/filter by album type and decade, "save to your Spotify library" (login required) with a toast confirming the save/remove, search-as-you-type suggestions, search history, and the light/dark theme toggle are all already built.

The decade pills (`js/app.js`, `getAvailableDecades`) are computed from whatever discography just loaded, not a fixed list — an artist with only 2010s–2020s releases won't show a `2000s` pill. `renderDecadePills` resets the selection to "All" on every new search.

The sort control (`#sort-button`/`#sort-menu` in `ui.js`) is a hand-built dropdown, not a native `<select>` — a native select's closed state can be themed but its open option list is drawn by the OS and ignores the page's CSS entirely, which broke the dark theme. Same floating-menu pattern as the profile dropdown (`#user-menu`): toggle on click, close on outside click/Escape.
