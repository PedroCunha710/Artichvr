import {
  searchArtist,
  getArtistAlbums,
  getCurrentUserProfile,
  checkAlbumsSaved,
  saveAlbum,
  removeSavedAlbum,
} from "./api.js";
import { redirectToLogin, handleRedirectCallback, getUserAccessToken, isLoggedIn, logout } from "./auth.js";
import {
  onSearchSubmit,
  onFilterChange,
  onSortChange,
  getActiveTypes,
  getSortOrder,
  onLoginClick,
  onLogoutClick,
  onSaveAlbumClick,
  setAlbumSaved,
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

    currentAlbums = albums.map((album) => ({ ...album, isSaved: false }));
    renderArtist(artist);
    renderAlbums(applyAlbumsView());
    clearStatus();

    await markAlreadySavedAlbums();
  } catch (error) {
    await waitForMinimumLoading(startedAt);
    showError(error.message || "Something went wrong.");
  }
});

onFilterChange(() => renderAlbums(applyAlbumsView()));
onSortChange(() => renderAlbums(applyAlbumsView()));

onLoginClick(() => redirectToLogin());

onLogoutClick(() => {
  logout();
  showLoggedOut();
});

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
    } else {
      await saveAlbum(albumId, token);
      album.isSaved = true;
    }
    setAlbumSaved(button, album.isSaved);
  } catch (error) {
    console.error(error);
  } finally {
    button.disabled = false;
  }
});

initAuth();

async function initAuth() {
  await handleRedirectCallback();

  const token = await getUserAccessToken();
  if (!token) {
    showLoggedOut();
    return;
  }

  try {
    const profile = await getCurrentUserProfile(token);
    showLoggedIn(profile.display_name || profile.id);
  } catch {
    showLoggedOut();
  }
}

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
