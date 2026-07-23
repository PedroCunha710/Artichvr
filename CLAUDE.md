# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Spotify Album Finder — a static, front-end-only web app to search an artist and browse their full discography via the Spotify Web API. Portfolio project: the priority is clean, readable, well-documented vanilla JS, not framework tricks. One small server-side exception: see `worker/` below and "CORS proxy".

## Stack

- HTML5 / CSS3 / JavaScript ES6+ (no framework, no bundler, no build step)
- Native ES modules (`<script type="module">`) — import/export between files in `js/`
- [GSAP](https://gsap.com/) for animation, loaded via CDN `<script>` tag (classic, not a module) before `app.js` — `window.gsap` is used as a global inside `ui.js`, no import statement. Chosen over more CSS `@keyframes` because it can orchestrate sequences (tonearm-drop-then-spin, staggered card entrances) that plain CSS animations handle awkwardly.
- Spotify Web API (Search, Artists, Albums endpoints)
- A single Cloudflare Worker (`worker/`) as a CORS proxy in front of `api.spotify.com` — see "CORS proxy" below. Otherwise no backend/server component.

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
worker/spotify-proxy.js  # Cloudflare Worker: CORS proxy in front of api.spotify.com, see "CORS proxy"
worker/wrangler.toml
assets/
```

Keep the `api.js` / `ui.js` / `app.js` separation: API/network code never touches the DOM, rendering code never calls `fetch`.

## Auth

Two separate flows, for two separate purposes:

- **Client Credentials** (`js/api.js`, `getAccessToken`) — app-level token for public catalog reads (search, artist albums). Called directly from the browser: there is no backend, so the Client Secret is bundled into front-end JS and technically exposed. Deliberate trade-off, acceptable for read-only public data with no user login; would need a server-side token proxy for anything with real secrets.
- **Authorization Code + PKCE** (`js/auth.js`) — user login, needed for anything done *as* the user (currently: saving/removing albums in their library, scopes `user-library-modify`/`user-library-read`). PKCE needs no client secret, so it's safe as a pure-frontend flow. Access + refresh tokens are kept in `localStorage`; the redirect URI is computed at runtime (`location.origin + location.pathname`) and must exactly match one registered in the Spotify dashboard, so the app must be opened at that exact URL (trailing slash included) for login to work.

Credentials live in `js/config.js`, which is gitignored. `js/config.example.js` is the template committed to the repo.

`config.js`'s `LOGIN_ENABLED` flag gates the login button and everything downstream of it (`js/app.js`'s `initAuth`/`hideLoginButton` in `js/ui.js`). It's `true` locally, but the GitHub Actions deploy workflow (`.github/workflows/deploy-pages.yml`) generates the deployed `config.js` with it hardcoded to `false`: Spotify's Development Mode caps this app at a handful of authorized accounts (5, as of February 2026), so the public deployment can't offer real login to arbitrary visitors — only accounts explicitly added in the Spotify Dashboard can log in at all, which would be confusing/broken for everyone else. Extended Quota Mode (which would lift that cap) isn't an option here: since May 2025 it's restricted to organizations with 250k+ MAU, not individual/portfolio projects.

Spotify's February 2026 Dev Mode changes removed the old content-specific library endpoints (`PUT`/`DELETE /me/albums`, `GET /me/albums/contains`) — they now 403 unconditionally regardless of scope. `js/api.js` uses the replacement generic endpoint (`/me/library`, `/me/library/contains`), which is keyed by full Spotify URI (`spotify:album:{id}`) rather than a bare ID; see `albumUri()`.

## CORS proxy

`accounts.spotify.com` (login/token requests, used by both `getAccessToken` in `js/api.js` and the whole of `js/auth.js`) sends CORS headers and works fine from a direct browser `fetch`. `api.spotify.com` (search, artist albums, `/me`, `/me/library` — everything `BASE_URL` in `js/api.js` points at) sends none, on any endpoint, confirmed by hitting it directly (`curl -i -X OPTIONS`) — the preflight comes back `200` with no `Access-Control-Allow-Origin` at all. That's a deliberate restriction on Spotify's end (matches long-standing reports on `spotify/web-api` and the Spotify community forums), not a bug or a Dashboard misconfiguration, and it blocks the request before it leaves the page regardless of Redirect URI setup.

`worker/spotify-proxy.js` works around this: a minimal Cloudflare Worker that forwards `BASE_URL` traffic to `api.spotify.com` server-to-server (where CORS doesn't apply), then re-attaches a permissive `Access-Control-Allow-Origin` header on the way back. `js/api.js`'s `BASE_URL` points at the deployed worker (`API_PROXY_URL` in `config.js`) instead of `api.spotify.com` directly; the worker itself holds no secrets and does nothing but pass the request through and reattach that header. It's the one deliberate exception to "no backend" in this project — everything else about the app is still a static site. `js/auth.js`'s calls to `accounts.spotify.com` are untouched and go straight there, since CORS already works for that domain.

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

- Every function in `js/` — exported or internal — gets a JSDoc block (`@param`/`@returns`/`@throws` as applicable), plus a `@fileoverview` at the top of each file. Deliberate exception to "no comments unless non-obvious": this project is open source, and JSDoc is written for a contributor who's never seen the code, not just for the one non-obvious line. Inline comments still follow the stricter rule below.
- Beyond the JSDoc blocks above, no inline comments unless the code hides a non-obvious reason (e.g. the auth trade-off above).
- Escape any text interpolated from the Spotify API into HTML templates (artist/album names) before rendering — don't assume API data is safe to inject raw.
- All user-facing strings and docs are in English.

## Roadmap (not yet built)

Nothing outstanding right now. Sort/filter by album type and decade, "save to your Spotify library" (login required) with a toast confirming the save/remove, search-as-you-type suggestions, search history, and the light/dark theme toggle are all already built.

The decade pills (`js/app.js`, `getAvailableDecades`) are computed from whatever discography just loaded, not a fixed list — an artist with only 2010s–2020s releases won't show a `2000s` pill. `renderDecadePills` resets the selection to "All" on every new search.

The album grid has three view modes — grid (default, larger covers than before), compact list, horizontal-scroll carousel — cycled by one button (`#view-toggle-button`) whose label always names the mode you'd switch *to* next. The chosen mode is a CSS class on `#albums-grid` (`view-grid`/`view-list`/`view-carousel`, `js/ui.js`) persisted to `localStorage.artichvr_view`; `renderAlbums` only touches `innerHTML`, never the class list, so the mode survives filter/sort/decade re-renders without needing to be re-applied.

The sort control (`#sort-button`/`#sort-menu` in `ui.js`) is a hand-built dropdown, not a native `<select>` — a native select's closed state can be themed but its open option list is drawn by the OS and ignores the page's CSS entirely, which broke the dark theme. Same floating-menu pattern as the profile dropdown (`#user-menu`): toggle on click, close on outside click/Escape.
