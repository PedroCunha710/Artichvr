/**
 * @fileoverview All DOM rendering and event wiring. No `fetch` calls live
 * here — `app.js` calls into `api.js`/`auth.js` and passes the results to
 * the render/`on*` functions exported below. `gsap` is loaded globally via
 * a `<script>` tag in `index.html` (no bundler in this project), so it's
 * used here as a bare global rather than an import.
 */

import { isMockMode } from "./mock.js";

if (isMockMode()) {
  const badge = document.createElement("div");
  badge.className = "mock-badge";
  badge.textContent = "Mock data";
  document.body.appendChild(badge);
}

/** Cached references to every DOM element this module touches. */
const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  suggestions: document.getElementById("search-suggestions"),
  artistCard: document.getElementById("artist-card"),
  albumsToolbar: document.getElementById("albums-toolbar"),
  albumsGrid: document.getElementById("albums-grid"),
  albumsEmpty: document.getElementById("albums-empty"),
  filterPills: Array.from(document.querySelectorAll(".filter-pill")),
  clearFiltersButton: document.getElementById("clear-filters-button"),
  decadePills: document.getElementById("decade-pills"),
  albumsCount: document.getElementById("albums-count"),
  viewToggleButton: document.getElementById("view-toggle-button"),
  sortButton: document.getElementById("sort-button"),
  sortMenu: document.getElementById("sort-menu"),
  sortLabel: document.getElementById("sort-label"),
  toast: document.getElementById("toast"),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  loader: document.getElementById("loader"),
  themeToggleButton: document.getElementById("theme-toggle-button"),
  loginButton: document.getElementById("login-button"),
  historyButton: document.getElementById("history-button"),
  logoutButton: document.getElementById("logout-button"),
  userChip: document.getElementById("user-chip"),
  userMenuButton: document.getElementById("user-menu-button"),
  userMenu: document.getElementById("user-menu"),
  userName: document.getElementById("user-name"),
  userAvatarImg: document.getElementById("user-avatar-img"),
  userAvatarFallback: document.getElementById("user-avatar-fallback"),
};

/** Maps Spotify's `album_type` values to the label shown on each album card. */
const ALBUM_TYPE_LABELS = {
  album: "Album",
  single: "Single",
  compilation: "Compilation",
};

const THEME_STORAGE_KEY = "artichvr_theme";

// The initial theme is already set on <html> by an inline script in index.html's
// <head>, before this module loads, so the page never flashes the wrong theme.
els.themeToggleButton.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
});

const VIEW_STORAGE_KEY = "artichvr_view";
const VIEW_MODES = ["grid", "list", "carousel"];
const VIEW_LABELS = { grid: "Grid view", list: "List view", carousel: "Carousel view" };

/**
 * Switches the album grid's layout mode and updates the toggle button's
 * label to name the mode it would switch to *next*. Persists the choice so
 * it survives reloads and filter/sort re-renders (`renderAlbums` only ever
 * touches `innerHTML`, never this class).
 *
 * @param {"grid"|"list"|"carousel"} mode
 */
function applyViewMode(mode) {
  els.albumsGrid.className = `albums-grid view-${mode}`;
  els.viewToggleButton.textContent = VIEW_LABELS[mode];
  localStorage.setItem(VIEW_STORAGE_KEY, mode);
}

const storedView = localStorage.getItem(VIEW_STORAGE_KEY);
applyViewMode(VIEW_MODES.includes(storedView) ? storedView : "grid");

els.viewToggleButton.addEventListener("click", () => {
  const current = localStorage.getItem(VIEW_STORAGE_KEY);
  const next = VIEW_MODES[(VIEW_MODES.indexOf(current) + 1) % VIEW_MODES.length];
  applyViewMode(next);
});

let vinylTimeline = null;
let errorTimeline = null;
let logoSpinTween = null;

/**
 * Plays the one-time page-load intro: cascading header/hero/footer reveal,
 * then starts a continuous slow ambient spin on the header logo and the
 * hero background photo carousel. Call once, on initial page load.
 */
export function playIntroAnimation() {
  gsap
    .timeline()
    .from(".logo-mark", { opacity: 0, rotation: -60, scale: 0.6, duration: 0.6, ease: "back.out(1.8)" })
    .from(".logo-text", { opacity: 0, x: -12, duration: 0.4, ease: "power2.out" }, "-=0.3")
    .from(".auth-area", { opacity: 0, duration: 0.4 }, "-=0.25")
    .from(".hero-title", { opacity: 0, y: 28, duration: 0.6, ease: "power3.out" }, "-=0.15")
    .from(".hero-subtitle", { opacity: 0, y: 18, duration: 0.5, ease: "power3.out" }, "-=0.35")
    .from(".search-form", { opacity: 0, y: 18, scale: 0.96, duration: 0.5, ease: "power3.out" }, "-=0.3")
    .from(".site-footer p", { opacity: 0, duration: 0.5 }, "-=0.2")
    .call(() => {
      logoSpinTween = gsap.to(".logo-mark", { rotation: "+=360", duration: 9, ease: "none", repeat: -1 });
    });

  playHeroBackgroundCarousel();
}

/**
 * Starts the hero background photo carousel: crossfades between
 * `.hero-bg-slide` elements every ~4 seconds, looping forever. A no-op if
 * there's fewer than two slides to crossfade between.
 */
function playHeroBackgroundCarousel() {
  const slides = Array.from(document.querySelectorAll(".hero-bg-slide"));
  if (slides.length < 2) return;

  const timeline = gsap.timeline({ repeat: -1 });
  slides.forEach((slide, index) => {
    const next = slides[(index + 1) % slides.length];
    timeline
      .to(slide, { opacity: 0, duration: 1.5, ease: "power1.inOut" }, "+=4")
      .to(next, { opacity: 1, duration: 1.5, ease: "power1.inOut" }, "<");
  });
}

/**
 * Registers the handler that runs a search when the search form is
 * submitted (Enter, or clicking Search).
 *
 * @param {(query: string) => void} handler - Called with the trimmed,
 *   non-empty search query.
 */
export function onSearchSubmit(handler) {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearSuggestions();
    const query = els.input.value.trim();
    if (query) handler(query);
  });
}

const SUGGESTION_DEBOUNCE_MS = 400;
const SUGGESTION_MIN_LENGTH = 2;
let suggestionDebounceTimer = null;
let currentSuggestions = [];
let highlightedIndex = -1;

/**
 * Registers the handler that fetches autocomplete suggestions as the user
 * types, debounced so it doesn't fire on every keystroke. Clears any
 * existing suggestions if the query is too short to search for.
 *
 * @param {(query: string) => void} handler - Called with the trimmed query,
 *   at most once every `SUGGESTION_DEBOUNCE_MS`.
 */
export function onSearchInput(handler) {
  els.input.addEventListener("input", () => {
    clearTimeout(suggestionDebounceTimer);
    const query = els.input.value.trim();

    if (query.length < SUGGESTION_MIN_LENGTH) {
      clearSuggestions();
      return;
    }

    suggestionDebounceTimer = setTimeout(() => handler(query), SUGGESTION_DEBOUNCE_MS);
  });
}

/**
 * Registers the handler that shows recent-search history when the search
 * input is focused while empty (i.e. before the user has typed anything).
 *
 * @param {() => void} handler
 */
export function onSearchFocus(handler) {
  els.input.addEventListener("focus", () => {
    if (els.input.value.trim() === "") handler();
  });
}

// Shared open/close for the suggestions, sort, and user-menu dropdowns: fade
// + slight drop-in, matching the toast's animation language. Guarded by the
// current `hidden` state so a rapid double-call (e.g. Escape while already
// closed) can't stack tweens or fight over the element's opacity.
const DROPDOWN_ANIM_S = 0.2;

/**
 * Reveals a dropdown element with a fade + slight drop-in animation.
 * A no-op if the element is already visible.
 *
 * @param {HTMLElement} el - The dropdown element (must use the `hidden` attribute).
 */
function openDropdown(el) {
  if (!el.hidden) return;
  el.hidden = false;
  gsap.killTweensOf(el);
  gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: DROPDOWN_ANIM_S, ease: "power2.out" });
}

/**
 * Hides a dropdown element with a fade-out animation, only setting `hidden`
 * once the animation completes. A no-op (aside from calling `onDone`
 * immediately) if the element is already hidden.
 *
 * @param {HTMLElement} el - The dropdown element (must use the `hidden` attribute).
 * @param {() => void} [onDone] - Called once the element is fully hidden
 *   (immediately, if it was already hidden). Used to defer clearing content
 *   until the fade-out finishes, so the dropdown doesn't visibly go blank
 *   mid-animation.
 */
function closeDropdown(el, onDone) {
  if (el.hidden) {
    onDone?.();
    return;
  }

  gsap.killTweensOf(el);
  gsap.to(el, {
    opacity: 0,
    y: -8,
    duration: DROPDOWN_ANIM_S,
    ease: "power2.in",
    onComplete: () => {
      el.hidden = true;
      onDone?.();
    },
  });
}

/**
 * Renders the autocomplete/history suggestions dropdown and opens it.
 * Closes the dropdown instead if there are no artists to show.
 *
 * @param {object[]} artists - Spotify artist objects to list.
 * @param {string} [heading] - Optional label shown above the list (e.g.
 *   `"Recent searches"`); omitted for live search-as-you-type results.
 */
export function renderSuggestions(artists, heading) {
  if (artists.length === 0) {
    clearSuggestions();
    return;
  }

  currentSuggestions = artists;
  highlightedIndex = -1;
  const headingHtml = heading ? `<li class="search-suggestions-heading">${escapeHtml(heading)}</li>` : "";
  els.suggestions.innerHTML =
    headingHtml +
    artists
      .map((artist, index) => {
        const photo = artist.images[artist.images.length - 1]?.url ?? "";
        return `
          <li>
            <button type="button" id="search-suggestion-${index}" class="search-suggestion" data-index="${index}">
              <img src="${photo}" alt="" />
              <span>${escapeHtml(artist.name)}</span>
            </button>
          </li>
        `;
      })
      .join("");

  openDropdown(els.suggestions);
  els.input.setAttribute("aria-expanded", "true");
}

/**
 * Closes the suggestions dropdown and clears its content once the
 * close animation finishes.
 */
export function clearSuggestions() {
  currentSuggestions = [];
  highlightedIndex = -1;
  closeDropdown(els.suggestions, () => {
    els.suggestions.innerHTML = "";
  });
  els.input.setAttribute("aria-expanded", "false");
  els.input.removeAttribute("aria-activedescendant");
}

/**
 * Moves the keyboard-navigation highlight to the given suggestion index,
 * wrapping around at either end, and keeps it scrolled into view. Updates
 * `aria-activedescendant` on the input so screen readers track the
 * highlighted item too.
 *
 * @param {number} index - Target index; may be out of `[0, length)`, in
 *   which case it wraps.
 */
function highlightSuggestion(index) {
  const items = Array.from(els.suggestions.querySelectorAll(".search-suggestion"));
  if (items.length === 0) return;

  highlightedIndex = (index + items.length) % items.length;
  items.forEach((item, i) => item.classList.toggle("is-highlighted", i === highlightedIndex));
  items[highlightedIndex].scrollIntoView({ block: "nearest" });
  els.input.setAttribute("aria-activedescendant", items[highlightedIndex].id);
}

// Arrow keys move the highlight through the open suggestions dropdown;
// Enter selects whichever item is highlighted (if any) instead of
// submitting the form.
els.input.addEventListener("keydown", (event) => {
  if (els.suggestions.hidden) return;
  const items = Array.from(els.suggestions.querySelectorAll(".search-suggestion"));
  if (items.length === 0) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightSuggestion(highlightedIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightSuggestion(highlightedIndex - 1);
  } else if (event.key === "Enter" && highlightedIndex >= 0) {
    event.preventDefault();
    items[highlightedIndex].click();
  }
});

/**
 * Registers the handler that fires when a suggestion is picked (by click
 * or keyboard Enter). Fills the search input with the chosen artist's name
 * and closes the dropdown before calling the handler.
 *
 * @param {(artist: object) => void} handler - Called with the full Spotify
 *   artist object for the chosen suggestion.
 */
export function onSuggestionSelect(handler) {
  els.suggestions.addEventListener("click", (event) => {
    const button = event.target.closest(".search-suggestion");
    if (!button) return;

    const artist = currentSuggestions[Number(button.dataset.index)];
    if (!artist) return;

    els.input.value = artist.name;
    clearSuggestions();
    handler(artist);
  });
}

document.addEventListener("click", (event) => {
  if (!els.suggestions.hidden && !event.target.closest(".search-input-wrap")) {
    clearSuggestions();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") clearSuggestions();
});

/**
 * Registers the handler that fires whenever an album-type filter pill
 * (Albums/Singles/Compilations) is toggled.
 *
 * @param {() => void} handler - Called after the clicked pill's active
 *   state has been toggled.
 */
export function onFilterChange(handler) {
  els.filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("is-active");
      handler();
    });
  });
}

/**
 * Registers the handler for the "Clear" filters button: re-activates every
 * type filter pill and resets the decade filter to "All" before calling
 * the handler.
 *
 * @param {() => void} handler
 */
export function onClearFilters(handler) {
  els.clearFiltersButton.addEventListener("click", () => {
    els.filterPills.forEach((pill) => pill.classList.add("is-active"));
    setActiveDecade("all");
    handler();
  });
}

let sortOrder = "newest";
const SORT_LABELS = { newest: "Newest first", oldest: "Oldest first" };

/**
 * Registers the handler that fires when the sort order changes, and wires
 * up the sort dropdown's open/close toggle and item selection. A custom
 * dropdown rather than a native `<select>`, since a native select's open
 * option list is drawn by the OS and can't be themed.
 *
 * @param {() => void} handler - Called after `getSortOrder()` reflects the newly chosen order.
 */
export function onSortChange(handler) {
  els.sortButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !els.sortMenu.hidden;
    isOpen ? closeSortMenu() : openSortMenu();
  });

  els.sortMenu.addEventListener("click", (event) => {
    const item = event.target.closest(".sort-item");
    if (!item) return;

    sortOrder = item.dataset.sort;
    els.sortLabel.textContent = SORT_LABELS[sortOrder];
    Array.from(els.sortMenu.children).forEach((child) => {
      child.classList.toggle("is-active", child === item);
    });
    closeSortMenu();
    handler();
  });
}

/** Opens the sort dropdown and marks the trigger button as expanded. */
function openSortMenu() {
  openDropdown(els.sortMenu);
  els.sortButton.setAttribute("aria-expanded", "true");
}

/** Closes the sort dropdown and marks the trigger button as collapsed. */
function closeSortMenu() {
  closeDropdown(els.sortMenu);
  els.sortButton.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (event) => {
  if (!els.sortMenu.hidden && !event.target.closest(".sort-dropdown")) closeSortMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSortMenu();
});

/**
 * Reads which album-type filter pills are currently active.
 *
 * @returns {string[]} Active `album_type` values (e.g. `["album", "single"]`).
 */
export function getActiveTypes() {
  return els.filterPills
    .filter((pill) => pill.classList.contains("is-active"))
    .map((pill) => pill.dataset.type);
}

let activeDecade = "all";

/**
 * Renders the decade filter pills for the decades actually present in the
 * current discography (plus an "All" pill), and resets the selection to
 * "All". Hides the whole row if there's nothing to filter by.
 *
 * @param {number[]} decades - Decades to offer as pills, e.g. `[2020, 2010]`.
 */
export function renderDecadePills(decades) {
  activeDecade = "all";

  if (decades.length === 0) {
    els.decadePills.hidden = true;
    els.decadePills.innerHTML = "";
    return;
  }

  els.decadePills.innerHTML =
    `<button type="button" class="decade-pill is-active" data-decade="all">All</button>` +
    decades
      .map((decade) => `<button type="button" class="decade-pill" data-decade="${decade}">${decade}s</button>`)
      .join("");

  els.decadePills.hidden = false;
}

/**
 * Marks a single decade pill (or "all") as the active one.
 *
 * @param {string} decade - `"all"` or a decade as a string, e.g. `"2020"`.
 */
function setActiveDecade(decade) {
  activeDecade = decade;
  Array.from(els.decadePills.children).forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.decade === decade);
  });
}

/**
 * Registers the handler that fires when a decade pill is clicked.
 *
 * @param {() => void} handler - Called after `getActiveDecade()` reflects
 *   the newly selected decade.
 */
export function onDecadeChange(handler) {
  els.decadePills.addEventListener("click", (event) => {
    const pill = event.target.closest(".decade-pill");
    if (!pill) return;

    setActiveDecade(pill.dataset.decade);
    handler();
  });
}

/**
 * Reads the currently selected decade filter.
 *
 * @returns {string} `"all"`, or a decade as a string, e.g. `"2020"`.
 */
export function getActiveDecade() {
  return activeDecade;
}

/**
 * Reads the currently selected sort order.
 *
 * @returns {"newest"|"oldest"}
 */
export function getSortOrder() {
  return sortOrder;
}

/**
 * Registers the handler for the "Log in with Spotify" button.
 *
 * @param {() => void} handler
 */
export function onLoginClick(handler) {
  els.loginButton.addEventListener("click", handler);
}

/**
 * Registers the handler for the "Log out" menu item.
 *
 * @param {() => void} handler
 */
export function onLogoutClick(handler) {
  els.logoutButton.addEventListener("click", handler);
}

/**
 * Registers the handler for the "History" profile-menu item: closes the
 * profile menu, scrolls/focuses the search input, then calls the handler
 * (which typically renders search history as suggestions).
 *
 * @param {() => void} handler
 */
export function onHistoryClick(handler) {
  els.historyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeUserMenu();
    els.input.scrollIntoView({ behavior: "smooth", block: "center" });
    els.input.focus();
    handler();
  });
}

/**
 * Registers the handler for clicking an album's Save/Saved button
 * (delegated from the grid container, since album cards are re-rendered
 * wholesale on every filter/sort change).
 *
 * @param {(albumId: string, button: HTMLButtonElement) => void} handler
 */
export function onSaveAlbumClick(handler) {
  els.albumsGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".save-button");
    if (button) handler(button.dataset.albumId, button);
  });
}

/**
 * Updates a Save button's visual state and plays a small "pop" animation
 * to acknowledge the click.
 *
 * @param {HTMLButtonElement} button - The album's Save button.
 * @param {boolean} isSaved - Whether the album is now saved.
 */
export function setAlbumSaved(button, isSaved) {
  button.classList.toggle("is-saved", isSaved);
  button.textContent = isSaved ? "Saved" : "Save";
  gsap.fromTo(button, { scale: 1 }, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" });
}

const TOAST_VISIBLE_MS = 2500;
let toastHideTimer = null;

/**
 * Shows a transient confirmation/error message at the bottom of the
 * screen, replacing any toast already showing, and auto-hides it after
 * `TOAST_VISIBLE_MS`.
 *
 * @param {string} message - Text to display.
 * @param {"success"|"error"} [variant="success"] - Visual style.
 */
export function showToast(message, variant = "success") {
  clearTimeout(toastHideTimer);
  gsap.killTweensOf(els.toast);

  els.toast.textContent = message;
  els.toast.classList.toggle("is-error", variant === "error");
  els.toast.hidden = false;
  gsap.fromTo(els.toast, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });

  toastHideTimer = setTimeout(() => {
    gsap.to(els.toast, {
      opacity: 0,
      y: 16,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        els.toast.hidden = true;
      },
    });
  }, TOAST_VISIBLE_MS);
}

/**
 * Permanently hides the login entry point, for deployments where
 * `config.js`'s `LOGIN_ENABLED` is `false` because Spotify's Development
 * Mode caps this app at a handful of authorized accounts and can't offer
 * real login to arbitrary visitors.
 */
export function hideLoginButton() {
  els.loginButton.hidden = true;
}

/**
 * Switches the header to its logged-out state: shows the login button,
 * hides the user chip, and closes the profile menu if it was open.
 */
export function showLoggedOut() {
  document.body.classList.remove("logged-in");
  els.loginButton.hidden = false;
  els.userChip.hidden = true;
  closeUserMenu();
}

/**
 * Switches the header to its logged-in state: shows the user's name and
 * avatar (falling back to their first initial if there's no avatar photo).
 *
 * @param {string} displayName - The user's Spotify display name (or ID as a fallback).
 * @param {string} [avatarUrl] - URL of the user's profile photo, if any.
 */
export function showLoggedIn(displayName, avatarUrl) {
  document.body.classList.add("logged-in");
  els.loginButton.hidden = true;
  els.userChip.hidden = false;
  els.userName.textContent = displayName;

  if (avatarUrl) {
    els.userAvatarImg.src = avatarUrl;
    els.userAvatarImg.hidden = false;
    els.userAvatarFallback.hidden = true;
  } else {
    els.userAvatarImg.hidden = true;
    els.userAvatarFallback.hidden = false;
    els.userAvatarFallback.textContent = displayName.charAt(0).toUpperCase();
  }
}

/** Closes the profile dropdown menu (History/Log out). */
function closeUserMenu() {
  closeDropdown(els.userMenu);
  els.userMenuButton.setAttribute("aria-expanded", "false");
}

els.userMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = !els.userMenu.hidden;
  if (isOpen) {
    closeUserMenu();
  } else {
    openDropdown(els.userMenu);
    els.userMenuButton.setAttribute("aria-expanded", "true");
  }
});

document.addEventListener("click", (event) => {
  if (!els.userChip.contains(event.target)) closeUserMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeUserMenu();
});

els.logoutButton.addEventListener("click", closeUserMenu);

/**
 * Switches the page into its loading state: collapses the hero (on the
 * first search only), clears any previous results, and starts the vinyl
 * loader animation.
 */
export function showLoading() {
  if (!document.body.classList.contains("has-results")) {
    document.body.classList.add("has-results");
    collapseHero();
  }

  stopErrorJitter();
  logoSpinTween?.pause();
  els.loader.hidden = false;
  els.status.hidden = true;
  els.albumsToolbar.hidden = true;
  els.albumsEmpty.hidden = true;
  els.artistCard.innerHTML = "";
  els.albumsGrid.innerHTML = "";
  playVinylLoader();
}

/**
 * Switches the page into its error state, showing the given message and
 * starting the needle-jitter animation.
 *
 * @param {string} message - Error text to display.
 */
export function showError(message) {
  stopVinylLoader();
  logoSpinTween?.pause();
  els.loader.hidden = true;
  els.status.hidden = false;
  els.albumsToolbar.hidden = true;
  els.albumsEmpty.hidden = true;
  els.statusText.textContent = message;
  playErrorJitter();
}

/**
 * Clears the loading/error status area and resumes the header logo's
 * ambient spin. Called once a search has successfully rendered results.
 */
export function clearStatus() {
  stopVinylLoader();
  stopErrorJitter();
  logoSpinTween?.resume();
  els.loader.hidden = true;
  els.status.hidden = true;
  els.statusText.textContent = "";
}

/**
 * Renders the artist header card (photo, name, follower count, Spotify
 * link) and plays its staggered entrance animation.
 *
 * @param {object} artist - Spotify artist object.
 */
export function renderArtist(artist) {
  const photo = artist.images[0]?.url ?? "";
  const followersTotal = artist.followers?.total;
  const followersLine =
    typeof followersTotal === "number"
      ? `<p>${followersTotal.toLocaleString("en-US")} followers</p>`
      : "";

  els.artistCard.innerHTML = `
    <img class="artist-photo" src="${photo}" alt="${escapeHtml(artist.name)}" />
    <div>
      <h2>${escapeHtml(artist.name)}</h2>
      ${followersLine}
      <a class="spotify-link" href="${artist.external_urls.spotify}" target="_blank" rel="noopener">
        Open on Spotify
      </a>
    </div>
  `;

  gsap.from(els.artistCard.children, {
    opacity: 0,
    y: 12,
    duration: 0.4,
    stagger: 0.08,
    ease: "power2.out",
  });
}

/**
 * Renders the album grid (or the "no albums match" empty state) and
 * updates the results count, then plays a staggered entrance animation for
 * the new cards.
 *
 * @param {object[]} albums - Albums to display, already filtered and sorted
 *   by the caller.
 */
export function renderAlbums(albums) {
  els.albumsToolbar.hidden = false;

  if (albums.length === 0) {
    els.albumsGrid.innerHTML = "";
    els.albumsEmpty.hidden = false;
    els.albumsCount.textContent = "";
    return;
  }

  els.albumsEmpty.hidden = true;
  els.albumsCount.textContent = `${albums.length} ${albums.length === 1 ? "album" : "albums"}`;
  els.albumsGrid.innerHTML = albums.map(albumCardHtml).join("");

  gsap.from(els.albumsGrid.querySelectorAll(".album-card"), {
    opacity: 0,
    y: 20,
    duration: 0.4,
    stagger: 0.04,
    ease: "power2.out",
  });
}

/**
 * Collapses the hero section (title/subtitle/search-bar area shrinks to a
 * compact bar, background photo fades out) the first time results appear.
 */
function collapseHero() {
  const heroCopy = document.querySelector(".hero-copy");
  const hero = document.querySelector(".hero");
  const startHeight = heroCopy.offsetHeight;

  gsap.set(heroCopy, { height: startHeight });
  gsap.to(heroCopy, { height: 0, opacity: 0, duration: 0.5, ease: "power2.inOut" });
  gsap.to(hero, { paddingTop: "1.5rem", paddingBottom: "1.5rem", duration: 0.5, ease: "power2.inOut" });
  gsap.to(".hero-bg, .hero-overlay", { opacity: 0, duration: 0.5, ease: "power2.inOut" });
}

/**
 * Plays the loading turntable animation: the tonearm drops onto the record,
 * then the vinyl disc's label spins continuously until stopped.
 *
 * svgOrigin (not transformOrigin) pins the pivot to a point in the SVG's own
 * viewBox coordinates - GSAP otherwise resolves px origins against the
 * rotating element's own tiny bounding box, sending it wildly off-center.
 */
function playVinylLoader() {
  vinylTimeline?.kill();
  gsap.set(".tonearm", { rotation: -18, svgOrigin: "129 20" });
  gsap.set(".vinyl-disc", { rotation: 0, svgOrigin: "70 65" });

  vinylTimeline = gsap
    .timeline()
    .to(".tonearm", { rotation: 0, duration: 0.7, ease: "power2.out", svgOrigin: "129 20" })
    .to(".vinyl-disc", { rotation: "+=360", duration: 1.1, ease: "none", repeat: -1, svgOrigin: "70 65" }, 0.7);
}

/** Stops and discards the loading turntable animation, if running. */
function stopVinylLoader() {
  vinylTimeline?.kill();
  vinylTimeline = null;
}

/** Plays the error state's needle-jitter animation, looping until stopped. */
function playErrorJitter() {
  errorTimeline?.kill();
  gsap.set(".error-needle", { rotation: 0, svgOrigin: "70 12" });

  errorTimeline = gsap
    .timeline({ repeat: -1, repeatDelay: 0.6 })
    .to(".error-needle", { rotation: -18, duration: 0.18, svgOrigin: "70 12" })
    .to(".error-needle", { rotation: 12, duration: 0.18 })
    .to(".error-needle", { rotation: -20, duration: 0.18 })
    .to(".error-needle", { rotation: 8, duration: 0.18 })
    .to(".error-needle", { rotation: 0, duration: 0.18 });
}

/** Stops and discards the error needle-jitter animation, if running. */
function stopErrorJitter() {
  errorTimeline?.kill();
  errorTimeline = null;
}

/**
 * Builds the HTML for a single album card, matching the currently
 * selected view mode (grid/list/carousel all reuse the same markup,
 * restyled via CSS).
 *
 * @param {object & {isSaved: boolean}} album - Spotify album object, plus
 *   the locally tracked `isSaved` flag.
 * @returns {string} HTML for one `.album-card`.
 */
function albumCardHtml(album) {
  const cover = album.images[0]?.url ?? "";
  const year = new Date(album.release_date).getFullYear();
  const type = ALBUM_TYPE_LABELS[album.album_type] ?? album.album_type;
  const savedClass = album.isSaved ? " is-saved" : "";
  const savedLabel = album.isSaved ? "Saved" : "Save";

  return `
    <div class="album-card">
      <a class="album-card-link" href="${album.external_urls.spotify}" target="_blank" rel="noopener">
        <img src="${cover}" alt="${escapeHtml(album.name)}" loading="lazy" />
        <div class="album-info">
          <h3>${escapeHtml(album.name)}</h3>
          <p>${year} • ${type}</p>
          <p>${album.total_tracks} tracks</p>
        </div>
      </a>
      <button type="button" class="save-button${savedClass}" data-album-id="${album.id}">${savedLabel}</button>
    </div>
  `;
}

/**
 * Escapes text for safe injection into an HTML template — Spotify API data
 * (artist/album names) is never assumed safe to insert raw.
 *
 * @param {string} text - Raw text to escape.
 * @returns {string} HTML-escaped text.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
