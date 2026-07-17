/**
 * @fileoverview Entry point: wires `ui.js`'s DOM events to `api.js`/`auth.js`
 * calls and back. Holds the only piece of application state — the current
 * artist's albums — and derives what's actually rendered (filtered, sorted)
 * from it plus whatever `ui.js` reports as the active filter/sort/decade.
 */

import {
  searchArtist,
  searchArtists,
  getArtistAlbums,
  getCurrentUserProfile,
  checkAlbumsSaved,
  saveAlbum,
  removeSavedAlbum,
} from "./api.js";
import { redirectToLogin, handleRedirectCallback, getUserAccessToken, isLoggedIn, logout } from "./auth.js";
import { getSearchHistory, addToSearchHistory } from "./history.js";
import {
  playIntroAnimation,
  onSearchSubmit,
  onSearchInput,
  onSearchFocus,
  renderSuggestions,
  clearSuggestions,
  onSuggestionSelect,
  onFilterChange,
  onClearFilters,
  renderDecadePills,
  onDecadeChange,
  getActiveDecade,
  onSortChange,
  getActiveTypes,
  getSortOrder,
  onLoginClick,
  onLogoutClick,
  onHistoryClick,
  onSaveAlbumClick,
  setAlbumSaved,
  showToast,
  showLoggedIn,
  showLoggedOut,
  showLoading,
  showError,
  clearStatus,
  renderArtist,
  renderAlbums,
} from "./ui.js";

// Real Spotify responses can come back in well under a second, which barely
// shows the turntable animation - hold the loading state for a bit so it reads.
const MIN_LOADING_MS = 1500;

/** @type {object[]} The current artist's full discography, as fetched (unfiltered). */
let currentAlbums = [];
/** @type {boolean} Guards against overlapping searches firing concurrently. */
let isSearching = false;

onSearchSubmit((query) => runSearch(() => searchArtist(query), `No artist found for "${query}".`));

onSuggestionSelect((artist) => runSearch(() => Promise.resolve(artist)));

onSearchInput(async (query) => {
  try {
    renderSuggestions(await searchArtists(query));
  } catch {
    clearSuggestions();
  }
});

onSearchFocus(() => renderSuggestions(getSearchHistory(), "Recent searches"));

/**
 * Drives a full search: resolves the target artist, fetches their
 * discography, and renders the result (or an error/not-found state). Shared
 * by both the search form (looks the artist up by name) and picking a
 * suggestion (the artist object is already known).
 *
 * Ignores calls while a search is already in flight, and holds the loading
 * state for at least `MIN_LOADING_MS` so fast responses don't just flash by.
 *
 * @param {() => Promise<object|null>} resolveArtist - Resolves to the
 *   Spotify artist object to search for, or `null` if none was found.
 * @param {string} [notFoundMessage] - Message shown if `resolveArtist`
 *   resolves to `null`.
 * @returns {Promise<void>}
 */
async function runSearch(resolveArtist, notFoundMessage) {
  if (isSearching) return;
  isSearching = true;
  clearSuggestions();
  showLoading();
  const startedAt = Date.now();

  try {
    const artist = await resolveArtist();

    if (!artist) {
      await waitForMinimumLoading(startedAt);
      showError(notFoundMessage || "Artist not found.");
      return;
    }

    const albums = await getArtistAlbums(artist.id);
    await waitForMinimumLoading(startedAt);

    addToSearchHistory(artist);
    currentAlbums = albums.map((album) => ({ ...album, isSaved: false }));
    renderArtist(artist);
    renderDecadePills(getAvailableDecades());
    renderAlbums(applyAlbumsView());
    clearStatus();

    await markAlreadySavedAlbums();
  } catch (error) {
    await waitForMinimumLoading(startedAt);
    showError(error.message || "Something went wrong.");
  } finally {
    isSearching = false;
  }
}

onFilterChange(() => renderAlbums(applyAlbumsView()));
onClearFilters(() => renderAlbums(applyAlbumsView()));
onDecadeChange(() => renderAlbums(applyAlbumsView()));
onSortChange(() => renderAlbums(applyAlbumsView()));

onLoginClick(() => redirectToLogin());

onLogoutClick(() => {
  logout();
  showLoggedOut();
});

onHistoryClick(() => renderSuggestions(getSearchHistory(), "Recent searches"));

onSaveAlbumClick(async (albumId, button) => {
  const token = await getUserAccessToken();
  if (!token) return;

  const album = currentAlbums.find((a) => a.id === albumId);
  if (!album) return;

  button.disabled = true;
  try {
    if (album.isSaved) {
      await removeSavedAlbum(albumId, token);
      album.isSaved = false;
      setAlbumSaved(button, false);
      showToast(`Removed "${album.name}" from your library.`);
    } else {
      await saveAlbum(albumId, token);
      album.isSaved = true;
      setAlbumSaved(button, true);
      showToast(`Saved "${album.name}" to your library.`);
    }
  } catch (error) {
    showToast(error.message || "Something went wrong.", "error");
  } finally {
    button.disabled = false;
  }
});

playIntroAnimation();
initAuth();

/**
 * Runs once on page load: completes a pending PKCE login redirect (if any),
 * then loads and displays the logged-in user's profile, falling back to the
 * logged-out UI if there's no valid session or the profile fetch fails.
 *
 * @returns {Promise<void>}
 */
async function initAuth() {
  await handleRedirectCallback();

  const token = await getUserAccessToken();
  if (!token) {
    showLoggedOut();
    return;
  }

  try {
    const profile = await getCurrentUserProfile(token);
    showLoggedIn(profile.display_name || profile.id, profile.images?.[0]?.url);
  } catch {
    showLoggedOut();
  }
}

/**
 * After a search completes, checks which of the newly loaded albums are
 * already in the logged-in user's library and updates their Save buttons
 * accordingly. A no-op while logged out or with no albums loaded; failures
 * are logged but don't interrupt the rest of the page.
 *
 * @returns {Promise<void>}
 */
async function markAlreadySavedAlbums() {
  if (!isLoggedIn() || currentAlbums.length === 0) return;

  const token = await getUserAccessToken();
  if (!token) return;

  try {
    const savedFlags = await checkAlbumsSaved(currentAlbums.map((album) => album.id), token);
    currentAlbums.forEach((album, index) => {
      album.isSaved = savedFlags[index];
    });
    renderAlbums(applyAlbumsView());
  } catch (error) {
    console.error(error);
  }
}

/**
 * Derives what should currently be rendered from `currentAlbums` plus
 * `ui.js`'s reported filter state: which album types are active, which
 * decade (if any) is selected, and the chosen sort order.
 *
 * @returns {object[]} The filtered, sorted subset of `currentAlbums` to display.
 */
function applyAlbumsView() {
  const activeTypes = new Set(getActiveTypes());
  const activeDecade = getActiveDecade();

  const filtered = currentAlbums.filter((album) => {
    if (!activeTypes.has(album.album_type)) return false;
    if (activeDecade === "all") return true;
    return String(decadeOf(album.release_date)) === activeDecade;
  });

  const sortDirection = getSortOrder() === "oldest" ? -1 : 1;
  return [...filtered].sort(
    (a, b) => sortDirection * (new Date(b.release_date) - new Date(a.release_date))
  );
}

/**
 * Lists the decades actually present in the current discography, so the
 * decade filter only ever offers choices that will return results.
 *
 * @returns {number[]} Decades (e.g. `2010`, `2020`) sorted newest first.
 */
function getAvailableDecades() {
  const decades = new Set(currentAlbums.map((album) => decadeOf(album.release_date)));
  return [...decades].sort((a, b) => b - a);
}

/**
 * Rounds a release date down to its decade.
 *
 * @param {string} releaseDate - An ISO-ish date string (e.g. `"2021-09-02"`).
 * @returns {number} The decade the date falls in, e.g. `2020`.
 */
function decadeOf(releaseDate) {
  return Math.floor(new Date(releaseDate).getFullYear() / 10) * 10;
}

/**
 * Returns a promise that resolves once at least `MIN_LOADING_MS` has
 * elapsed since `startedAt`, so a search that resolves instantly still
 * shows the loading animation briefly instead of flashing.
 *
 * @param {number} startedAt - `Date.now()` timestamp from when the search began.
 * @returns {Promise<void>}
 */
function waitForMinimumLoading(startedAt) {
  const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
  return remaining > 0 ? new Promise((resolve) => setTimeout(resolve, remaining)) : Promise.resolve();
}
