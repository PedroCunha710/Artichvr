# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Spotify Album Finder — a static, front-end-only web app to search an artist and browse their full discography via the Spotify Web API. Portfolio project: the priority is clean, readable, well-documented vanilla JS, not framework tricks.

## Stack

- HTML5 / CSS3 / JavaScript ES6+ (no framework, no bundler, no build step)
- Native ES modules (`<script type="module">`) — import/export between files in `js/`
- Spotify Web API (Search, Artists, Albums endpoints)
- No backend/server component

## Structure

```
index.html
css/style.css      # dark theme, Spotify green accents (#121212 / #1db954)
js/api.js          # all Spotify API calls (app-level + user-level), auth token handling
js/auth.js         # user login: PKCE Authorization Code flow, token storage/refresh
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

## Running locally

Needs to be served over HTTP (ES modules and the Spotify token request don't work over `file://`). Any static server works, e.g. `npx serve` or VS Code's Live Server.

## Conventions

- No comments unless the code hides a non-obvious reason (e.g. the auth trade-off above).
- Escape any text interpolated from the Spotify API into HTML templates (artist/album names) before rendering — don't assume API data is safe to inject raw.
- All user-facing strings and docs are in English.

## Roadmap (not yet built)

Real-time search-as-you-type, search history (localStorage), light/dark theme toggle. Sort/filter by album type and "save to your Spotify library" (login required) are already built.
