import { searchArtist, getArtistAlbums } from "./api.js";
import {
  onSearchSubmit,
  onFilterChange,
  onSortChange,
  getActiveTypes,
  getSortOrder,
  showLoading,
  showError,
  clearStatus,
  renderArtist,
  renderAlbums,
} from "./ui.js";

// Real Spotify responses can come back in well under a second, which barely
// shows the turntable animation - hold the loading state for a bit so it reads.
const MIN_LOADING_MS = 2500;

let currentAlbums = [];

onSearchSubmit(async (query) => {
  showLoading();
  const startedAt = Date.now();

  try {
    const artist = await searchArtist(query);

    if (!artist) {
      await waitForMinimumLoading(startedAt);
      showError(`No artist found for "${query}".`);
      return;
    }

    const albums = await getArtistAlbums(artist.id);
    await waitForMinimumLoading(startedAt);

    currentAlbums = albums;
    renderArtist(artist);
    renderAlbums(applyAlbumsView());
    clearStatus();
  } catch (error) {
    await waitForMinimumLoading(startedAt);
    showError(error.message || "Something went wrong.");
  }
});

onFilterChange(() => renderAlbums(applyAlbumsView()));
onSortChange(() => renderAlbums(applyAlbumsView()));

function applyAlbumsView() {
  const activeTypes = new Set(getActiveTypes());
  const filtered = currentAlbums.filter((album) => activeTypes.has(album.album_type));

  const sortDirection = getSortOrder() === "oldest" ? -1 : 1;
  return [...filtered].sort(
    (a, b) => sortDirection * (new Date(b.release_date) - new Date(a.release_date))
  );
}

function waitForMinimumLoading(startedAt) {
  const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
  return remaining > 0 ? new Promise((resolve) => setTimeout(resolve, remaining)) : Promise.resolve();
}
