/**
 * @fileoverview Dev-only fixture data and a toggle to bypass the real Spotify
 * API entirely, so UI work (filters, theme, save flow, history) doesn't burn
 * into Spotify's Development Mode rate limit. Enable with `?mock=1` in the
 * URL (persists via `localStorage` until visited again with `?mock=0`).
 * Consumed by `api.js` (catalog + library reads/writes) and `auth.js`
 * (fake login session) — never touched by production behavior otherwise.
 */

const MOCK_MODE_KEY = "artichvr_mock";
const MOCK_SESSION_KEY = "artichvr_mock_session";

/**
 * Whether the app should serve fixture data instead of calling Spotify.
 *
 * Reads the `mock` query-string parameter first; if present, it both
 * answers the call and persists its value to `localStorage` so mock mode
 * survives subsequent page loads without needing the parameter every time.
 * Falls back to whatever was last persisted when the parameter is absent.
 *
 * @returns {boolean} `true` if mock mode is currently enabled.
 */
export function isMockMode() {
  const params = new URLSearchParams(location.search);
  if (params.has("mock")) {
    const enabled = params.get("mock") !== "0";
    localStorage.setItem(MOCK_MODE_KEY, enabled ? "1" : "0");
    return enabled;
  }
  return localStorage.getItem(MOCK_MODE_KEY) === "1";
}

/**
 * Whether the fake mock-mode session is currently "logged in".
 * Defaults to `true` so mock mode starts logged in without extra setup.
 *
 * @returns {boolean}
 */
export function isMockLoggedIn() {
  return localStorage.getItem(MOCK_SESSION_KEY) !== "0";
}

/**
 * Sets the fake mock-mode login state, used by `auth.js` in place of a
 * real Spotify PKCE login/logout while mock mode is active.
 *
 * @param {boolean} value - `true` to simulate a logged-in user, `false` to log out.
 */
export function setMockLoggedIn(value) {
  localStorage.setItem(MOCK_SESSION_KEY, value ? "1" : "0");
}

/** A single fixture artist, shaped like a Spotify artist object. */
export const MOCK_ARTIST = {
  id: "mock-artist-1",
  name: "Nova Static",
  images: [
    { url: "https://picsum.photos/seed/novastatic/640", height: 640, width: 640 },
    { url: "https://picsum.photos/seed/novastatic/320", height: 320, width: 320 },
  ],
  followers: { total: 482913 },
  external_urls: { spotify: "#" },
};

/**
 * Fixture artists returned by mock search/autocomplete, `MOCK_ARTIST` plus
 * two others so multi-result UI (the suggestions dropdown, keyboard nav
 * between several items) has something real to exercise.
 */
export const MOCK_SUGGESTIONS = [
  MOCK_ARTIST,
  {
    id: "mock-artist-2",
    name: "Glass Harbor",
    images: [{ url: "https://picsum.photos/seed/glassharbor/320" }],
    external_urls: { spotify: "#" },
  },
  {
    id: "mock-artist-3",
    name: "Paper Cranes",
    images: [{ url: "https://picsum.photos/seed/papercranes/320" }],
    external_urls: { spotify: "#" },
  },
];

/**
 * Fixture discography for `MOCK_ARTIST`, deliberately spanning multiple
 * album types (album/single/compilation) and decades (2000s–2020s) so the
 * type filters, decade pills, and sort order all have real variation to
 * test against.
 */
export const MOCK_ALBUMS = [
  { id: "m1", name: "Afterglow", album_type: "album", release_date: "2024-03-15", total_tracks: 12, images: [{ url: "https://picsum.photos/seed/m1/300" }], external_urls: { spotify: "#" } },
  { id: "m2", name: "Static & Sway", album_type: "album", release_date: "2021-09-02", total_tracks: 10, images: [{ url: "https://picsum.photos/seed/m2/300" }], external_urls: { spotify: "#" } },
  { id: "m3", name: "Low Light", album_type: "single", release_date: "2023-06-20", total_tracks: 1, images: [{ url: "https://picsum.photos/seed/m3/300" }], external_urls: { spotify: "#" } },
  { id: "m4", name: "Rewound", album_type: "compilation", release_date: "2018-11-11", total_tracks: 16, images: [{ url: "https://picsum.photos/seed/m4/300" }], external_urls: { spotify: "#" } },
  { id: "m5", name: "Origin", album_type: "album", release_date: "2015-05-05", total_tracks: 9, images: [{ url: "https://picsum.photos/seed/m5/300" }], external_urls: { spotify: "#" } },
  { id: "m6", name: "Faultlines", album_type: "single", release_date: "2012-02-14", total_tracks: 1, images: [{ url: "https://picsum.photos/seed/m6/300" }], external_urls: { spotify: "#" } },
  { id: "m7", name: "First Light", album_type: "album", release_date: "2009-08-30", total_tracks: 11, images: [{ url: "https://picsum.photos/seed/m7/300" }], external_urls: { spotify: "#" } },
];

/** Fixture profile returned by `getCurrentUserProfile` in mock mode. */
export const MOCK_PROFILE = {
  display_name: "Mock User",
  id: "mock-user",
  images: [],
};

/**
 * In-memory "library" of saved album IDs for mock mode. Resets on every
 * page reload — mock mode is a testing aid, not a persistent fake backend.
 * @type {Set<string>}
 */
const mockSavedIds = new Set();

/**
 * Mock equivalent of `checkAlbumsSaved` — reports which of the given album
 * IDs are in the in-memory mock library.
 *
 * @param {string[]} albumIds - Album IDs to check.
 * @returns {boolean[]} One boolean per input ID, same order, `true` if saved.
 */
export function mockCheckSaved(albumIds) {
  return albumIds.map((id) => mockSavedIds.has(id));
}

/**
 * Mock equivalent of `saveAlbum` — adds an album ID to the in-memory
 * mock library.
 *
 * @param {string} albumId
 */
export function mockSave(albumId) {
  mockSavedIds.add(albumId);
}

/**
 * Mock equivalent of `removeSavedAlbum` — removes an album ID from the
 * in-memory mock library.
 *
 * @param {string} albumId
 */
export function mockRemove(albumId) {
  mockSavedIds.delete(albumId);
}
