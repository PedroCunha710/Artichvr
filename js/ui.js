import { isMockMode } from "./mock.js";

if (isMockMode()) {
  const badge = document.createElement("div");
  badge.className = "mock-badge";
  badge.textContent = "Mock data";
  document.body.appendChild(badge);
}

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

// gsap is loaded globally via a <script> tag in index.html (no bundler in this project).
let vinylTimeline = null;
let errorTimeline = null;
let logoSpinTween = null;

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

export function onSearchFocus(handler) {
  els.input.addEventListener("focus", () => {
    if (els.input.value.trim() === "") handler();
  });
}

export function renderSuggestions(artists, heading) {
  if (artists.length === 0) {
    clearSuggestions();
    return;
  }

  currentSuggestions = artists;
  const headingHtml = heading ? `<li class="search-suggestions-heading">${escapeHtml(heading)}</li>` : "";
  els.suggestions.innerHTML =
    headingHtml +
    artists
      .map((artist, index) => {
        const photo = artist.images[artist.images.length - 1]?.url ?? "";
        return `
          <li>
            <button type="button" class="search-suggestion" data-index="${index}">
              <img src="${photo}" alt="" />
              <span>${escapeHtml(artist.name)}</span>
            </button>
          </li>
        `;
      })
      .join("");

  els.suggestions.hidden = false;
  els.input.setAttribute("aria-expanded", "true");
}

export function clearSuggestions() {
  currentSuggestions = [];
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";
  els.input.setAttribute("aria-expanded", "false");
}

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

export function onFilterChange(handler) {
  els.filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("is-active");
      handler();
    });
  });
}

export function onClearFilters(handler) {
  els.clearFiltersButton.addEventListener("click", () => {
    els.filterPills.forEach((pill) => pill.classList.add("is-active"));
    setActiveDecade("all");
    handler();
  });
}

let sortOrder = "newest";
const SORT_LABELS = { newest: "Newest first", oldest: "Oldest first" };

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

function openSortMenu() {
  els.sortMenu.hidden = false;
  els.sortButton.setAttribute("aria-expanded", "true");
}

function closeSortMenu() {
  els.sortMenu.hidden = true;
  els.sortButton.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (event) => {
  if (!els.sortMenu.hidden && !event.target.closest(".sort-dropdown")) closeSortMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSortMenu();
});

export function getActiveTypes() {
  return els.filterPills
    .filter((pill) => pill.classList.contains("is-active"))
    .map((pill) => pill.dataset.type);
}

let activeDecade = "all";

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

function setActiveDecade(decade) {
  activeDecade = decade;
  Array.from(els.decadePills.children).forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.decade === decade);
  });
}

export function onDecadeChange(handler) {
  els.decadePills.addEventListener("click", (event) => {
    const pill = event.target.closest(".decade-pill");
    if (!pill) return;

    setActiveDecade(pill.dataset.decade);
    handler();
  });
}

export function getActiveDecade() {
  return activeDecade;
}

export function getSortOrder() {
  return sortOrder;
}

export function onLoginClick(handler) {
  els.loginButton.addEventListener("click", handler);
}

export function onLogoutClick(handler) {
  els.logoutButton.addEventListener("click", handler);
}

export function onHistoryClick(handler) {
  els.historyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeUserMenu();
    els.input.scrollIntoView({ behavior: "smooth", block: "center" });
    els.input.focus();
    handler();
  });
}

export function onSaveAlbumClick(handler) {
  els.albumsGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".save-button");
    if (button) handler(button.dataset.albumId, button);
  });
}

export function setAlbumSaved(button, isSaved) {
  button.classList.toggle("is-saved", isSaved);
  button.textContent = isSaved ? "Saved" : "Save";
  gsap.fromTo(button, { scale: 1 }, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" });
}

const TOAST_VISIBLE_MS = 2500;
let toastHideTimer = null;

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

export function showLoggedOut() {
  document.body.classList.remove("logged-in");
  els.loginButton.hidden = false;
  els.userChip.hidden = true;
  closeUserMenu();
}

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

function closeUserMenu() {
  els.userMenu.hidden = true;
  els.userMenuButton.setAttribute("aria-expanded", "false");
}

els.userMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = !els.userMenu.hidden;
  if (isOpen) {
    closeUserMenu();
  } else {
    els.userMenu.hidden = false;
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

export function clearStatus() {
  stopVinylLoader();
  stopErrorJitter();
  logoSpinTween?.resume();
  els.loader.hidden = true;
  els.status.hidden = true;
  els.statusText.textContent = "";
}

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

export function renderAlbums(albums) {
  els.albumsToolbar.hidden = false;

  if (albums.length === 0) {
    els.albumsGrid.innerHTML = "";
    els.albumsEmpty.hidden = false;
    return;
  }

  els.albumsEmpty.hidden = true;
  els.albumsGrid.innerHTML = albums.map(albumCardHtml).join("");

  gsap.from(els.albumsGrid.querySelectorAll(".album-card"), {
    opacity: 0,
    y: 20,
    duration: 0.4,
    stagger: 0.04,
    ease: "power2.out",
  });
}

function collapseHero() {
  const heroCopy = document.querySelector(".hero-copy");
  const hero = document.querySelector(".hero");
  const startHeight = heroCopy.offsetHeight;

  gsap.set(heroCopy, { height: startHeight });
  gsap.to(heroCopy, { height: 0, opacity: 0, duration: 0.5, ease: "power2.inOut" });
  gsap.to(hero, { paddingTop: "1.5rem", paddingBottom: "1.5rem", duration: 0.5, ease: "power2.inOut" });
  gsap.to(".hero-bg, .hero-overlay", { opacity: 0, duration: 0.5, ease: "power2.inOut" });
}

function playVinylLoader() {
  vinylTimeline?.kill();
  // svgOrigin (not transformOrigin) pins the pivot to a point in the SVG's own
  // viewBox coordinates - GSAP otherwise resolves px origins against the
  // rotating element's own tiny bounding box, sending it wildly off-center.
  gsap.set(".tonearm", { rotation: -18, svgOrigin: "129 20" });
  gsap.set(".vinyl-disc", { rotation: 0, svgOrigin: "70 65" });

  vinylTimeline = gsap
    .timeline()
    .to(".tonearm", { rotation: 0, duration: 0.7, ease: "power2.out", svgOrigin: "129 20" })
    .to(".vinyl-disc", { rotation: "+=360", duration: 1.1, ease: "none", repeat: -1, svgOrigin: "70 65" }, 0.7);
}

function stopVinylLoader() {
  vinylTimeline?.kill();
  vinylTimeline = null;
}

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

function stopErrorJitter() {
  errorTimeline?.kill();
  errorTimeline = null;
}

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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
