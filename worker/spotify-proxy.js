/**
 * @fileoverview Cloudflare Worker that proxies browser calls to Spotify's
 * Web API (`api.spotify.com`). That domain never sends CORS headers on its
 * data endpoints (search, artists, albums, /me, /me/library) - only
 * `accounts.spotify.com`'s auth endpoints do - so a direct browser `fetch`
 * to it is blocked before the request ever leaves the page. This worker
 * makes the same request server-to-server, where CORS doesn't apply, then
 * re-attaches a permissive CORS header on the way back to the browser.
 * Deployed separately from the static front-end; see the README for setup.
 */

const SPOTIFY_API = "https://api.spotify.com/v1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
};

export default {
  /**
   * Forwards the incoming request's method, path, query string, and
   * Authorization header to Spotify's Web API, then returns Spotify's
   * response with CORS headers attached so the browser will accept it.
   *
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const target = `${SPOTIFY_API}${url.pathname}${url.search}`;

    const spotifyResponse = await fetch(target, {
      method: request.method,
      headers: { Authorization: request.headers.get("Authorization") ?? "" },
    });

    // Building the response from a plain headers object rather than copying
    // spotifyResponse's headers wholesale: `fetch` already transparently
    // decompresses the body, but the original Content-Encoding/Content-Length
    // headers would still say "gzip"/the compressed size, which makes
    // Cloudflare choke trying to decode an already-decoded body.
    const headers = new Headers(CORS_HEADERS);
    const contentType = spotifyResponse.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);

    return new Response(spotifyResponse.body, {
      status: spotifyResponse.status,
      statusText: spotifyResponse.statusText,
      headers,
    });
  },
};
