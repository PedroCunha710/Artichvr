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
};

const ALBUM_TYPE_LABELS = {
  album: "Album",
  single: "Single",
  compilation: "Compilation",
};

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

export function showLoading() {
  document.body.classList.add("has-results");
  els.loader.hidden = false;
  els.status.hidden = true;
  els.albumsToolbar.hidden = true;
  els.albumsEmpty.hidden = true;
  els.artistCard.innerHTML = "";
  els.albumsGrid.innerHTML = "";
}

export function showError(message) {
  els.loader.hidden = true;
  els.status.hidden = false;
  els.albumsToolbar.hidden = true;
  els.albumsEmpty.hidden = true;
  els.statusText.textContent = message;
}

export function clearStatus() {
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
}

function albumCardHtml(album) {
  const cover = album.images[0]?.url ?? "";
  const year = new Date(album.release_date).getFullYear();
  const type = ALBUM_TYPE_LABELS[album.album_type] ?? album.album_type;

  return `
    <a class="album-card" href="${album.external_urls.spotify}" target="_blank" rel="noopener">
      <img src="${cover}" alt="${escapeHtml(album.name)}" loading="lazy" />
      <div class="album-info">
        <h3>${escapeHtml(album.name)}</h3>
        <p>${year} • ${type}</p>
        <p>${album.total_tracks} tracks</p>
      </div>
    </a>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
