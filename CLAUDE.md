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
js/api.js          # all Spotify API calls + auth token handling
js/ui.js           # DOM rendering, no fetch calls here
js/app.js          # entry point, wires ui.js events to api.js calls
js/config.js       # gitignored — real credentials, created from config.example.js
js/config.example.js
assets/
```

Keep the `api.js` / `ui.js` / `app.js` separation: API/network code never touches the DOM, rendering code never calls `fetch`.

## Auth

Uses the Client Credentials flow, called directly from the browser (`js/api.js`). This is a deliberate trade-off, not an oversight: there is no backend, so the Client Secret is bundled into front-end JS and technically exposed. That's acceptable for this portfolio project (read-only public catalog data, no user login, no sensitive data) but would need a server-side token proxy before reusing this pattern for anything with real secrets or user auth.

Credentials live in `js/config.js`, which is gitignored. `js/config.example.js` is the template committed to the repo.

## Running locally

Needs to be served over HTTP (ES modules and the Spotify token request don't work over `file://`). Any static server works, e.g. `npx serve` or VS Code's Live Server.

## Conventions

- No comments unless the code hides a non-obvious reason (e.g. the auth trade-off above).
- Escape any text interpolated from the Spotify API into HTML templates (artist/album names) before rendering — don't assume API data is safe to inject raw.
- All user-facing strings and docs are in English.

## Roadmap (not yet built)

Real-time search-as-you-type, sort/filter by album type, favorites, search history (localStorage), light/dark theme toggle. MVP is search → artist → full album list only.
