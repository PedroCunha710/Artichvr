/**
 * @fileoverview Recent-searches list: the last few artists a user searched
 * for, persisted to `localStorage` so they survive a page reload. Purely a
 * local convenience feature — never sent to Spotify or any server.
 */

const STORAGE_KEY = "artichvr_search_history";
const MAX_HISTORY = 8;

/**
 * Reads the saved search history, most recent first.
 *
 * @returns {Array<{id: string, name: string, images: object[]}>} Up to
 *   `MAX_HISTORY` previously searched artists, or an empty array if there's
 *   no history yet or the stored value is corrupt/unparsable.
 */
export function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

/**
 * Records an artist as the most recent search, moving it to the front if
 * it was already in the history, then trims the list to `MAX_HISTORY`.
 *
 * @param {{id: string, name: string, images: object[]}} artist - The Spotify
 *   artist object that was just searched for. Only `id`, `name`, and
 *   `images` are kept.
 */
export function addToSearchHistory(artist) {
  const entry = { id: artist.id, name: artist.name, images: artist.images };
  const history = getSearchHistory().filter((item) => item.id !== entry.id);
  history.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}
