const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  artistCard: document.getElementById("artist-card"),
  albumsGrid: document.getElementById("albums-grid"),
  status: document.getElementById("status"),
};

const ALBUM_TYPE_LABELS = {
  album: "Álbum",
  single: "Single",
  compilation: "Compilação",
};

export function onSearchSubmit(handler) {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = els.input.value.trim();
    if (query) handler(query);
  });
}

export function showLoading() {
  els.status.hidden = false;
  els.status.textContent = "A procurar...";
  els.artistCard.innerHTML = "";
  els.albumsGrid.innerHTML = "";
}

export function showError(message) {
  els.status.hidden = false;
  els.status.textContent = message;
}

export function clearStatus() {
  els.status.hidden = true;
  els.status.textContent = "";
}

export function renderArtist(artist) {
  const photo = artist.images[0]?.url ?? "";
  const followers = artist.followers.total.toLocaleString("pt-PT");

  els.artistCard.innerHTML = `
    <img class="artist-photo" src="${photo}" alt="${escapeHtml(artist.name)}" />
    <div>
      <h2>${escapeHtml(artist.name)}</h2>
      <p>${followers} seguidores</p>
      <a class="spotify-link" href="${artist.external_urls.spotify}" target="_blank" rel="noopener">
        Abrir no Spotify
      </a>
    </div>
  `;
}

export function renderAlbums(albums) {
  if (albums.length === 0) {
    els.albumsGrid.innerHTML = "";
    showError("Este artista não tem álbuns disponíveis.");
    return;
  }

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
        <p>${album.total_tracks} faixas</p>
      </div>
    </a>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
