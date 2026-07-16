import { CLIENT_ID, CLIENT_SECRET } from "./config.js";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const BASE_URL = "https://api.spotify.com/v1";

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Could not authenticate with the Spotify API.");
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 5000;
  return accessToken;
}

const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BACKOFF_MS = 3000;
const PAGINATION_DELAY_MS = 300;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyFetch(url, attempt = 0) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    // Spotify's 429 response includes a Retry-After header, but it isn't in
    // Access-Control-Expose-Headers, so cross-origin fetch can't read it from
    // the browser. Back off with a fixed, increasing delay instead.
    await wait(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
    return spotifyFetch(url, attempt + 1);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Spotify is rate-limiting this app right now. Please wait a moment and try again.");
    }
    throw new Error(`Error ${response.status} while querying the Spotify API.`);
  }

  return response.json();
}

export async function searchArtists(name, limit = 6) {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(name)}&type=artist&limit=${limit}`;
  const data = await spotifyFetch(url);
  return data.artists.items;
}

export async function searchArtist(name) {
  const results = await searchArtists(name, 1);
  return results[0] ?? null;
}

export async function getArtistAlbums(artistId) {
  const albums = [];
  // Docs say limit can go up to 50, but dev-mode apps get "Invalid limit" above 10; pagination via `next` covers the rest.
  let url = `${BASE_URL}/artists/${artistId}/albums?include_groups=album,single,compilation&limit=10&market=US`;

  while (url) {
    const data = await spotifyFetch(url);
    albums.push(...data.items);
    url = data.next;
    // Space out pagination requests so a big discography doesn't burst past
    // Spotify's rate limit before a single 429 ever comes back.
    if (url) await wait(PAGINATION_DELAY_MS);
  }

  return dedupeAlbums(albums);
}

function dedupeAlbums(albums) {
  const seen = new Map();
  for (const album of albums) {
    const key = album.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, album);
  }
  return [...seen.values()].sort(
    (a, b) => new Date(b.release_date) - new Date(a.release_date)
  );
}

// The functions below act on behalf of a logged-in user, so they take a user
// access token (from auth.js) rather than the app-level token above.

export async function getCurrentUserProfile(userToken) {
  const response = await fetch(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not load your Spotify profile.");
  }

  return response.json();
}

export async function checkAlbumsSaved(albumIds, userToken) {
  const results = [];

  for (let i = 0; i < albumIds.length; i += 50) {
    const chunk = albumIds.slice(i, i + 50);
    const response = await fetch(`${BASE_URL}/me/albums/contains?ids=${chunk.join(",")}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    if (!response.ok) {
      throw new Error("Could not check which albums are already saved.");
    }

    results.push(...(await response.json()));
  }

  return results;
}

export async function saveAlbum(albumId, userToken) {
  const response = await fetch(`${BASE_URL}/me/albums?ids=${albumId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not save this album to your library.");
  }
}

export async function removeSavedAlbum(albumId, userToken) {
  const response = await fetch(`${BASE_URL}/me/albums?ids=${albumId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not remove this album from your library.");
  }
}
