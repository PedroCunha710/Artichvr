// Dev-only fixture data and a toggle to bypass the real Spotify API entirely,
// so UI work (filters, theme, save flow, history) doesn't burn into Spotify's
// Development Mode rate limit. Enable with ?mock=1 (persists via localStorage
// until ?mock=0), never touched by production behavior otherwise.
const MOCK_MODE_KEY = "artichvr_mock";
const MOCK_SESSION_KEY = "artichvr_mock_session";

export function isMockMode() {
  const params = new URLSearchParams(location.search);
  if (params.has("mock")) {
    const enabled = params.get("mock") !== "0";
    localStorage.setItem(MOCK_MODE_KEY, enabled ? "1" : "0");
    return enabled;
  }
  return localStorage.getItem(MOCK_MODE_KEY) === "1";
}

export function isMockLoggedIn() {
  return localStorage.getItem(MOCK_SESSION_KEY) !== "0";
}

export function setMockLoggedIn(value) {
  localStorage.setItem(MOCK_SESSION_KEY, value ? "1" : "0");
}

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

export const MOCK_ALBUMS = [
  { id: "m1", name: "Afterglow", album_type: "album", release_date: "2024-03-15", total_tracks: 12, images: [{ url: "https://picsum.photos/seed/m1/300" }], external_urls: { spotify: "#" } },
  { id: "m2", name: "Static & Sway", album_type: "album", release_date: "2021-09-02", total_tracks: 10, images: [{ url: "https://picsum.photos/seed/m2/300" }], external_urls: { spotify: "#" } },
  { id: "m3", name: "Low Light", album_type: "single", release_date: "2023-06-20", total_tracks: 1, images: [{ url: "https://picsum.photos/seed/m3/300" }], external_urls: { spotify: "#" } },
  { id: "m4", name: "Rewound", album_type: "compilation", release_date: "2018-11-11", total_tracks: 16, images: [{ url: "https://picsum.photos/seed/m4/300" }], external_urls: { spotify: "#" } },
  { id: "m5", name: "Origin", album_type: "album", release_date: "2015-05-05", total_tracks: 9, images: [{ url: "https://picsum.photos/seed/m5/300" }], external_urls: { spotify: "#" } },
  { id: "m6", name: "Faultlines", album_type: "single", release_date: "2012-02-14", total_tracks: 1, images: [{ url: "https://picsum.photos/seed/m6/300" }], external_urls: { spotify: "#" } },
  { id: "m7", name: "First Light", album_type: "album", release_date: "2009-08-30", total_tracks: 11, images: [{ url: "https://picsum.photos/seed/m7/300" }], external_urls: { spotify: "#" } },
];

export const MOCK_PROFILE = {
  display_name: "Mock User",
  id: "mock-user",
  images: [],
};

const mockSavedIds = new Set();

export function mockCheckSaved(albumIds) {
  return albumIds.map((id) => mockSavedIds.has(id));
}

export function mockSave(albumId) {
  mockSavedIds.add(albumId);
}

export function mockRemove(albumId) {
  mockSavedIds.delete(albumId);
}
