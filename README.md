# 🎵 Spotify Album Finder

Open source web app to search any artist and browse their full discography via the Spotify Web API.

Personal project built to demonstrate REST API consumption, DOM manipulation, and modern JavaScript (ES6+) best practices, with no frameworks or build tools.

## Demo

> 🔗 _Link to the live version (GitHub Pages / Netlify / Vercel) — add here once published._

## Screenshots

> 📸 _Add screenshots of the app here (search, artist card, album grid) once the interface is ready._

## Features

- Search for an artist by name
- Lists all albums, singles, and compilations
- For each album: cover art, name, release date, track count, type, and a direct link to Spotify
- Responsive UI with a dark theme
- Loading and error states

### Planned extras

- Real-time search
- Sort by date and filter by album type
- Search history (localStorage) and favorites

## Tech stack

- HTML5
- CSS3
- JavaScript (ES6+, native modules, no bundler)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- Git & GitHub

## Project structure

```
spotify-album-finder/
│
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js              # Spotify API calls + authentication
│   ├── ui.js                # DOM rendering
│   ├── app.js                # wires api.js and ui.js together
│   ├── config.js             # real credentials (not committed)
│   └── config.example.js     # configuration template
├── assets/
├── README.md
└── LICENSE
```

## Running locally

This project has no build step, but ES modules and the Spotify token request only work when served over HTTP (don't open `index.html` directly with `file://`).

```bash
git clone https://github.com/<your-username>/spotify-album-finder.git
cd spotify-album-finder
npx serve
```

Or use the VS Code **Live Server** extension.

## Configuring the Spotify API

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and get your **Client ID** and **Client Secret**.
2. Copy the configuration template:
   ```bash
   cp js/config.example.js js/config.js
   ```
3. Fill in `js/config.js` with your credentials:
   ```js
   export const CLIENT_ID = "your-client-id";
   export const CLIENT_SECRET = "your-client-secret";
   ```
4. `js/config.js` is in `.gitignore` — never commit your credentials.

> ⚠️ This project uses the **Client Credentials Flow** directly in the browser (no backend), so the Client Secret is exposed in client-side code. That's acceptable for a demo project with public data and no user login; it's not the recommended pattern for a production app handling sensitive data.

## License

Distributed under the MIT license. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! To propose a change:

1. Fork the repository
2. Create a branch (`git checkout -b feature/your-feature-name`)
3. Commit your changes
4. Open a Pull Request describing the change

Suggestions and bug reports can be opened in [Issues](../../issues).
