/**
 * @fileoverview All Spotify Web API calls, both app-level (Client
 * Credentials — public catalog search/browse) and user-level (the caller
 * supplies a user access token from `auth.js` for library reads/writes).
 * No DOM access here; see `ui.js` for rendering and `app.js` for wiring
 * the two together. Every exported function checks `mock.js`'s mock mode
 * first and, if active, returns fixture data instead of calling `fetch`.
 */

import { CLIENT_ID, CLIENT_SECRET } from "./config.js";
import { isMockMode, MOCK_SUGGESTIONS, MOCK_ALBUMS, MOCK_PROFILE, mockCheckSaved, mockSave, mockRemove } from "./mock.js";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const BASE_URL = "https://api.spotify.com/v1";

let accessToken = null;
let tokenExpiresAt = 0;

/**
 * Returns a valid app-level access token for public catalog reads (search,
 * artist albums), fetching a new one via the Client Credentials flow if the
 * cached token has expired. The Client Secret is bundled into this
 * front-end file and technically exposed — a deliberate trade-off,
 * acceptable for read-only public data with no user login involved.
 *
 * @returns {Promise<string>} The app-level access token.
 * @throws {Error} If Spotify rejects the credentials request.
 */
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Could not authenticate with the Spotify API.");
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 5000;
  return accessToken;
}

const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BACKOFF_MS = 3000;
const PAGINATION_DELAY_MS = 300;

/**
 * Resolves after the given delay. Used to space out paginated requests and
 * to back off between rate-limit retries.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a Spotify catalog endpoint with the app-level token attached,
 * retrying with a fixed, increasing backoff on 429 (rate limited) responses
 * before giving up.
 *
 * @param {string} url - Full Spotify API URL to fetch.
 * @param {number} [attempt=0] - Current retry attempt, used internally for
 *   the recursive backoff; callers should omit it.
 * @returns {Promise<object>} The parsed JSON response body.
 * @throws {Error} If the response is a non-retryable error, or all retries
 *   are exhausted while rate-limited.
 */
async function spotifyFetch(url, attempt = 0) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    // Spotify's 429 response includes a Retry-After header, but it isn't in
    // Access-Control-Expose-Headers, so cross-origin fetch can't read it from
    // the browser. Back off with a fixed, increasing delay instead.
    await wait(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
    return spotifyFetch(url, attempt + 1);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Spotify is rate-limiting this app right now. Please wait a moment and try again.");
    }
    throw new Error(`Error ${response.status} while querying the Spotify API.`);
  }

  return response.json();
}

/**
 * Searches for artists by name.
 *
 * @param {string} name - Free-text artist name query.
 * @param {number} [limit=6] - Maximum number of results.
 * @returns {Promise<object[]>} Matching Spotify artist objects, most
 *   relevant first. In mock mode, filters the fixture artists by
 *   case-insensitive substring match, falling back to all of them if
 *   nothing matches — any query text is a valid test input, not just the
 *   three fixture names.
 */
export async function searchArtists(name, limit = 6) {
  if (isMockMode()) {
    await wait(300);
    const matches = MOCK_SUGGESTIONS.filter((artist) => artist.name.toLowerCase().includes(name.toLowerCase()));
    return (matches.length > 0 ? matches : MOCK_SUGGESTIONS).slice(0, limit);
  }

  const url = `${BASE_URL}/search?q=${encodeURIComponent(name)}&type=artist&limit=${limit}`;
  const data = await spotifyFetch(url);
  return data.artists.items;
}

/**
 * Searches for a single best-matching artist by name.
 *
 * @param {string} name - Free-text artist name query.
 * @returns {Promise<object|null>} The top matching Spotify artist object,
 *   or `null` if nothing matched.
 */
export async function searchArtist(name) {
  const results = await searchArtists(name, 1);
  return results[0] ?? null;
}

/**
 * Fetches an artist's full discography (albums, singles, and
 * compilations), paginating through all result pages and removing
 * duplicate releases (e.g. regional re-issues of the same album).
 *
 * @param {string} artistId - Spotify artist ID.
 * @returns {Promise<object[]>} Deduplicated album objects, newest first.
 */
export async function getArtistAlbums(artistId) {
  if (isMockMode()) {
    await wait(400);
    return dedupeAlbums(MOCK_ALBUMS);
  }

  const albums = [];
  // Docs say limit can go up to 50, but dev-mode apps get "Invalid limit" above 10; pagination via `next` covers the rest.
  let url = `${BASE_URL}/artists/${artistId}/albums?include_groups=album,single,compilation&limit=10&market=US`;

  while (url) {
    const data = await spotifyFetch(url);
    albums.push(...data.items);
    url = data.next;
    // Space out pagination requests so a big discography doesn't burst past
    // Spotify's rate limit before a single 429 ever comes back.
    if (url) await wait(PAGINATION_DELAY_MS);
  }

  return dedupeAlbums(albums);
}

/**
 * Removes duplicate albums (same name, case-insensitive — Spotify often
 * lists the same release multiple times for different markets/editions)
 * and sorts the result by release date, newest first.
 *
 * @param {object[]} albums - Raw album objects, possibly containing duplicates.
 * @returns {object[]} Deduplicated, sorted album objects.
 */
function dedupeAlbums(albums) {
  const seen = new Map();
  for (const album of albums) {
    const key = album.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, album);
  }
  return [...seen.values()].sort(
    (a, b) => new Date(b.release_date) - new Date(a.release_date)
  );
}

// The functions below act on behalf of a logged-in user, so they take a user
// access token (from auth.js) rather than the app-level token above.

/**
 * Extracts a human-readable reason from a failed Spotify API response.
 * Spotify's error bodies carry the real reason (e.g. a scope problem) in
 * JSON, so surfacing it is the fastest way to tell a permissions issue
 * apart from a rate limit or a network failure — much more useful than a
 * bare status code in the UI.
 *
 * @param {Response} response - A `fetch` response with `response.ok === false`.
 * @returns {Promise<string>} `"{status}: {message}"` if Spotify provided a
 *   message, otherwise just the status code as a string.
 */
async function describeError(response) {
  try {
    const body = await response.json();
    return body?.error?.message ? `${response.status}: ${body.error.message}` : String(response.status);
  } catch {
    return String(response.status);
  }
}

/**
 * Fetches the logged-in user's Spotify profile.
 *
 * @param {string} userToken - User access token from `auth.js`.
 * @returns {Promise<object>} The Spotify user profile object.
 * @throws {Error} If the request fails, with Spotify's reason included.
 */
export async function getCurrentUserProfile(userToken) {
  if (isMockMode()) return MOCK_PROFILE;

  const response = await fetch(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!response.ok) {
    throw new Error(`Could not load your Spotify profile (${await describeError(response)}).`);
  }

  return response.json();
}

/**
 * Builds the Spotify URI Spotify's library endpoints expect for an album,
 * URL-encoded for use as a query-string value.
 *
 * Spotify's February 2026 Dev Mode changes removed the content-specific
 * PUT/DELETE /me/albums and GET /me/albums/contains endpoints (they now 403
 * unconditionally, scope notwithstanding) in favor of one generic library
 * endpoint keyed by Spotify URI ("spotify:album:{id}") instead of a bare ID.
 *
 * @param {string} albumId - Spotify album ID.
 * @returns {string} URL-encoded `spotify:album:{id}` URI.
 */
function albumUri(albumId) {
  return encodeURIComponent(`spotify:album:${albumId}`);
}

/**
 * Checks which of the given albums are already saved in the logged-in
 * user's library, chunking requests to stay under Spotify's 40-URI limit
 * per call.
 *
 * @param {string[]} albumIds - Spotify album IDs to check.
 * @param {string} userToken - User access token from `auth.js`.
 * @returns {Promise<boolean[]>} One boolean per input ID, same order,
 *   `true` if that album is saved.
 * @throws {Error} If any chunk's request fails, with Spotify's reason included.
 */
export async function checkAlbumsSaved(albumIds, userToken) {
  if (isMockMode()) {
    await wait(200);
    return mockCheckSaved(albumIds);
  }

  const results = [];

  for (let i = 0; i < albumIds.length; i += 40) {
    const chunk = albumIds.slice(i, i + 40);
    const uris = chunk.map(albumUri).join(",");
    const response = await fetch(`${BASE_URL}/me/library/contains?uris=${uris}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    if (!response.ok) {
      throw new Error(`Could not check which albums are already saved (${await describeError(response)}).`);
    }

    results.push(...(await response.json()));
  }

  return results;
}

/**
 * Saves an album to the logged-in user's library.
 *
 * @param {string} albumId - Spotify album ID to save.
 * @param {string} userToken - User access token from `auth.js`.
 * @returns {Promise<void>}
 * @throws {Error} If the request fails, with Spotify's reason included.
 */
export async function saveAlbum(albumId, userToken) {
  if (isMockMode()) {
    await wait(200);
    return mockSave(albumId);
  }

  const response = await fetch(`${BASE_URL}/me/library?uris=${albumUri(albumId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!response.ok) {
    throw new Error(`Could not save this album to your library (${await describeError(response)}).`);
  }
}

/**
 * Removes an album from the logged-in user's library.
 *
 * @param {string} albumId - Spotify album ID to remove.
 * @param {string} userToken - User access token from `auth.js`.
 * @returns {Promise<void>}
 * @throws {Error} If the request fails, with Spotify's reason included.
 */
export async function removeSavedAlbum(albumId, userToken) {
  if (isMockMode()) {
    await wait(200);
    return mockRemove(albumId);
  }

  const response = await fetch(`${BASE_URL}/me/library?uris=${albumUri(albumId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!response.ok) {
    throw new Error(`Could not remove this album from your library (${await describeError(response)}).`);
  }
}
