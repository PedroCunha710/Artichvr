const STORAGE_KEY = "artichvr_search_history";
const MAX_HISTORY = 8;

export function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(artist) {
  const entry = { id: artist.id, name: artist.name, images: artist.images };
  const history = getSearchHistory().filter((item) => item.id !== entry.id);
  history.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}
