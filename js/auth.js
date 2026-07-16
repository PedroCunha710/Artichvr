import { CLIENT_ID } from "./config.js";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "user-library-modify user-library-read";

const STORAGE_KEYS = {
  verifier: "artichvr_pkce_verifier",
  accessToken: "artichvr_access_token",
  refreshToken: "artichvr_refresh_token",
  expiresAt: "artichvr_expires_at",
};

// Must exactly match a Redirect URI registered in the Spotify dashboard,
// including the trailing slash - open the app at that exact URL for login to work.
function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues, (value) => chars[value % chars.length]).join("");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function redirectToLogin() {
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

function storeTokens(data) {
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + data.expires_in * 1000 - 5000));
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }
}

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

export async function getUserAccessToken() {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (!token) return null;

  const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt));
  if (Date.now() < expiresAt) return token;

  return refreshAccessToken();
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem(STORAGE_KEYS.accessToken));
}

export function logout() {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.expiresAt);
}
