# 🎵 Artichvr

Open source web app to search any artist and browse their full discography via the Spotify Web API.

Personal project built to demonstrate REST API consumption, DOM manipulation, and modern JavaScript (ES6+) best practices, with no frameworks or build tools.

## Demo

> 🔗 _Link to the live version (GitHub Pages / Netlify / Vercel) — add here once published._

## Screenshots

> 📸 _Add screenshots of the app here (search, artist card, album grid) once the interface is ready._

## Features

- Search for an artist by name, with real-time search-as-you-type suggestions (keyboard-navigable)
- Lists all albums, singles, and compilations
- For each album: cover art, name, release date, track count, type, and a direct link to Spotify
- Sort by release date, filter by album type and by decade
- Grid, list, and carousel view modes for the album grid
- Log in with Spotify (Authorization Code + PKCE) to save/remove albums to your own library, with a toast confirmation
- Recent search history, accessible from the profile menu
- Light/dark theme toggle
- Responsive UI with GSAP-powered animations (page intro, loading, error states, card entrances)
- Loading and error states, including handling for Spotify rate limiting
- Offline/mock test mode (`?mock=1`) for developing without burning API rate limits

## Tech stack

- HTML5
- CSS3
- JavaScript (ES6+, native modules, no bundler)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- Git & GitHub

## Project structure

```
Artichvr/
│
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js              # Spotify API calls (public + user-scoped)
│   ├── auth.js              # user login (Authorization Code + PKCE)
│   ├── ui.js                # DOM rendering
│   ├── app.js                # wires api.js, auth.js and ui.js together
│   ├── config.js             # real credentials (not committed)
│   └── config.example.js     # configuration template
├── assets/
├── README.md
└── LICENSE
```

## Running locally

This project has no build step, but ES modules and the Spotify token request only work when served over HTTP (don't open `index.html` directly with `file://`).

```bash
git clone https://github.com/PedroCunha710/Artichvr.git
cd Artichvr
npx serve
```

Or use the VS Code **Live Server** extension.

## Configuring the Spotify API

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and get your **Client ID** and **Client Secret**.
2. In the app's **Settings**, add a **Redirect URI** matching exactly where you'll open the app locally, e.g. `http://127.0.0.1:5500/` (trailing slash included) — this is required for the "Log in with Spotify" button to work, even though the app has no backend.
3. Copy the configuration template:
   ```bash
   cp js/config.example.js js/config.js
   ```
4. Fill in `js/config.js` with your credentials and your deployed proxy URL from the next section:
   ```js
   export const CLIENT_ID = "your-client-id";
   export const CLIENT_SECRET = "your-client-secret";
   export const API_PROXY_URL = "https://your-worker-subdomain.workers.dev";
   ```
5. `js/config.js` is in `.gitignore` — never commit your credentials.

> ⚠️ Search and album browsing use the **Client Credentials Flow** directly in the browser (no backend), so the Client Secret is exposed in client-side code. That's acceptable for a demo project with public data; it's not the recommended pattern for a production app handling real secrets. Logging in and saving albums use a separate **Authorization Code + PKCE** flow instead, which needs no client secret and is the correct pattern for user-facing actions in a backend-less app.

## CORS proxy (required for real data)

`accounts.spotify.com` (used for login/token requests) sends CORS headers and works fine from the browser directly. `api.spotify.com` (used for search, artist albums, profile, and library — basically everything else) does not send CORS headers on any of its endpoints, so a direct browser `fetch` to it is blocked before the request even leaves the page, regardless of your Redirect URI or Dashboard setup. This is a deliberate restriction on Spotify's end, not a bug in this app.

To work around it, `worker/spotify-proxy.js` is a small [Cloudflare Worker](https://developers.cloudflare.com/workers/) that forwards requests to `api.spotify.com` server-to-server (where CORS doesn't apply) and re-attaches a permissive CORS header on the way back. It's the only server-side piece in an otherwise backend-less project, and exists solely to work around this Spotify limitation — it doesn't hold any secrets or do anything beyond pass the request through.

Deploy your own (free tier is enough):

```bash
cd worker
npx wrangler login    # opens a browser to authenticate with your Cloudflare account
npx wrangler deploy
```

This prints a URL like `https://artichvr-spotify-proxy.<your-subdomain>.workers.dev` — put that in `js/config.js` as `API_PROXY_URL` (see above). Without mock mode, none of the real search/login/library features work until this is deployed and configured.

## License

Distributed under the MIT license. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! To propose a change:

1. Fork the repository
2. Create a branch (`git checkout -b feature/your-feature-name`)
3. Commit your changes
4. Open a Pull Request describing the change

Suggestions and bug reports can be opened in [Issues](../../issues).
