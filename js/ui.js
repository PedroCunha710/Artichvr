const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  artistCard: document.getElementById("artist-card"),
  albumsToolbar: document.getElementById("albums-toolbar"),
  albumsGrid: document.getElementById("albums-grid"),
  albumsEmpty: document.getElementById("albums-empty"),
  filterPills: Array.from(document.querySelectorAll(".filter-pill")),
  sortSelect: document.getElementById("sort-select"),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  loader: document.getElementById("loader"),
  loginButton: document.getElementById("login-button"),
  logoutButton: document.getElementById("logout-button"),
  userChip: document.getElementById("user-chip"),
  userName: document.getElementById("user-name"),
};

const ALBUM_TYPE_LABELS = {
  album: "Album",
  single: "Single",
  compilation: "Compilation",
};

// gsap is loaded globally via a <script> tag in index.html (no bundler in this project).
let vinylTimeline = null;
let errorTimeline = null;

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
      gsap.to(".logo-mark", { rotation: "+=360", duration: 9, ease: "none", repeat: -1 });
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
    const query = els.input.value.trim();
    if (query) handler(query);
  });
}

export function onFilterChange(handler) {
  els.filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("is-active");
      handler();
    });
  });
}

export function onSortChange(handler) {
  els.sortSelect.addEventListener("change", handler);
}

export function getActiveTypes() {
  return els.filterPills
    .filter((pill) => pill.classList.contains("is-active"))
    .map((pill) => pill.dataset.type);
}

export function getSortOrder() {
  return els.sortSelect.value;
}

export function onLoginClick(handler) {
  els.loginButton.addEventListener("click", handler);
}

export function onLogoutClick(handler) {
  els.logoutButton.addEventListener("click", handler);
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

export function showLoggedOut() {
  document.body.classList.remove("logged-in");
  els.loginButton.hidden = false;
  els.userChip.hidden = true;
}

export function showLoggedIn(displayName) {
  document.body.classList.add("logged-in");
  els.loginButton.hidden = true;
  els.userChip.hidden = false;
  els.userName.textContent = displayName;
}

export function showLoading() {
  if (!document.body.classList.contains("has-results")) {
    document.body.classList.add("has-results");
    collapseHero();
  }

  stopErrorJitter();
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
  gsap.set(".tonearm", { rotation: -18 });
  gsap.set(".vinyl-disc", { rotation: 0 });

  vinylTimeline = gsap
    .timeline()
    .to(".tonearm", { rotation: 0, duration: 0.7, ease: "power2.out" })
    .to(".vinyl-disc", { rotation: "+=360", duration: 1.1, ease: "none", repeat: -1 }, 0.7);
}

function stopVinylLoader() {
  vinylTimeline?.kill();
  vinylTimeline = null;
}

function playErrorJitter() {
  errorTimeline?.kill();
  gsap.set(".error-needle", { rotation: 0 });

  errorTimeline = gsap
    .timeline({ repeat: -1 })
    .to(".error-needle", { rotation: -22, duration: 0.075 })
    .to(".error-needle", { rotation: 16, duration: 0.075 })
    .to(".error-needle", { rotation: -26, duration: 0.075 })
    .to(".error-needle", { rotation: 12, duration: 0.075 })
    .to(".error-needle", { rotation: -16, duration: 0.075 })
    .to(".error-needle", { rotation: 20, duration: 0.075 })
    .to(".error-needle", { rotation: 0, duration: 0.075 });
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
