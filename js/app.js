import { searchArtist, getArtistAlbums } from "./api.js";
import {
  onSearchSubmit,
  showLoading,
  showError,
  clearStatus,
  renderArtist,
  renderAlbums,
} from "./ui.js";

onSearchSubmit(async (query) => {
  showLoading();

  try {
    const artist = await searchArtist(query);

    if (!artist) {
      showError(`No artist found for "${query}".`);
      return;
    }

    renderArtist(artist);
    const albums = await getArtistAlbums(artist.id);
    renderAlbums(albums);
    clearStatus();
  } catch (error) {
    showError(error.message || "Something went wrong.");
  }
});
