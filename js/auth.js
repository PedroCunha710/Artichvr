/**
 * @fileoverview User login via the Authorization Code + PKCE flow, needed
 * for anything done *as* the Spotify user (currently: saving/removing
 * albums in their library). Separate from `api.js`'s Client Credentials
 * flow, which only reads public catalog data and never represents a user.
 * PKCE needs no client secret, so it's safe to run entirely in the browser.
 * Access/refresh tokens live in `localStorage`; every exported function also
 * checks `mock.js`'s mock mode first and, if active, fakes the session
 * instead of talking to Spotify at all.
 */

import { CLIENT_ID } from "./config.js";
import { isMockMode, isMockLoggedIn, setMockLoggedIn } from "./mock.js";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "user-library-modify user-library-read";

const STORAGE_KEYS = {
  verifier: "artichvr_pkce_verifier",
  accessToken: "artichvr_access_token",
  refreshToken: "artichvr_refresh_token",
  expiresAt: "artichvr_expires_at",
};

/**
 * The redirect URI Spotify will send the user back to after login.
 * Must exactly match a Redirect URI registered in the Spotify dashboard,
 * including the trailing slash — open the app at that exact URL for login
 * to work.
 *
 * @returns {string}
 */
function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

/**
 * Generates a cryptographically random string for use as a PKCE code
 * verifier.
 *
 * @param {number} length - Number of characters to generate.
 * @returns {string}
 */
function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues, (value) => chars[value % chars.length]).join("");
}

/**
 * Derives the PKCE code challenge from a verifier, per RFC 7636: SHA-256
 * the verifier, then base64url-encode the digest.
 *
 * @param {string} verifier
 * @returns {Promise<string>}
 */
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

/**
 * Encodes a binary digest as base64url (base64 with `+`/`/`/padding
 * replaced), the format PKCE and JWTs expect.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Starts the login flow: generates a PKCE verifier/challenge pair, stashes
 * the verifier for `handleRedirectCallback` to use later, then redirects
 * the browser to Spotify's authorize screen.
 *
 * In mock mode, skips Spotify entirely and just flips the fake session on,
 * reloading the page so the rest of the app picks up the "logged in" state.
 *
 * @returns {Promise<void>} Never resolves in the real flow — the browser
 *   navigates away before the promise would settle.
 */
export async function redirectToLogin() {
  if (isMockMode()) {
    setMockLoggedIn(true);
    window.location.reload();
    return;
  }

  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem(STORAGE_KEYS.verifier, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.href = `${AUTHORIZE_URL}?${params}`;
}

/**
 * Completes the login flow after Spotify redirects back with an
 * authorization code in the URL: exchanges the code (plus the stashed PKCE
 * verifier) for an access/refresh token pair, then strips the code from the
 * URL so a page refresh can't replay it.
 *
 * A no-op if there's no `code` query parameter — safe to call unconditionally
 * on every page load.
 *
 * @returns {Promise<void>}
 */
export async function handleRedirectCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return;

  const verifier = localStorage.getItem(STORAGE_KEYS.verifier);
  localStorage.removeItem(STORAGE_KEYS.verifier);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });

  // Strip the auth code from the URL either way, so a refresh doesn't replay it.
  window.history.replaceState({}, document.title, url.pathname);

  if (response.ok) {
    storeTokens(await response.json());
  }
}

/**
 * Persists a Spotify token response to `localStorage`, converting the
 * relative `expires_in` (seconds) into an absolute timestamp so later reads
 * don't need to remember when the token was issued.
 *
 * @param {{access_token: string, expires_in: number, refresh_token?: string}} data
 */
function storeTokens(data) {
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + data.expires_in * 1000 - 5000));
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }
}

/**
 * Exchanges the stored refresh token for a new access token when the
 * current one has expired. Logs the user out if there's no refresh token
 * to use, or if Spotify rejects it (e.g. it was revoked).
 *
 * @returns {Promise<string|null>} The new access token, or `null` if
 *   refreshing wasn't possible and the user was logged out instead.
 */
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) {
    logout();
    return null;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    logout();
    return null;
  }

  const data = await response.json();
  storeTokens(data);
  return data.access_token;
}

/**
 * Returns a valid user access token for calling Spotify's library
 * endpoints, refreshing it first if it has expired.
 *
 * In mock mode, returns a constant placeholder token when the fake session
 * is "logged in", or `null` otherwise — nothing is ever sent over the
 * network for it.
 *
 * @returns {Promise<string|null>} The access token, or `null` if the user
 *   isn't logged in (or the refresh failed).
 */
export async function getUserAccessToken() {
  if (isMockMode()) return isMockLoggedIn() ? "mock-token" : null;

  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (!token) return null;

  const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt));
  if (Date.now() < expiresAt) return token;

  return refreshAccessToken();
}

/**
 * Whether a user is currently logged in (real or mocked).
 *
 * @returns {boolean}
 */
export function isLoggedIn() {
  if (isMockMode()) return isMockLoggedIn();
  return Boolean(localStorage.getItem(STORAGE_KEYS.accessToken));
}

/**
 * Logs the user out: in mock mode, just flips the fake session off; for a
 * real session, clears the stored access/refresh tokens so
 * `getUserAccessToken`/`isLoggedIn` behave as logged-out from now on.
 */
export function logout() {
  if (isMockMode()) {
    setMockLoggedIn(false);
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.expiresAt);
}
