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
      showError(`Nenhum artista encontrado para "${query}".`);
      return;
    }

    renderArtist(artist);
    const albums = await getArtistAlbums(artist.id);
    renderAlbums(albums);
    clearStatus();
  } catch (error) {
    showError(error.message || "Ocorreu um erro inesperado.");
  }
});
