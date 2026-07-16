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

async function spotifyFetch(url) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status} while querying the Spotify API.`);
  }

  return response.json();
}

export async function searchArtist(name) {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(name)}&type=artist&limit=1`;
  const data = await spotifyFetch(url);
  return data.artists.items[0] ?? null;
}

export async function getArtistAlbums(artistId) {
  const albums = [];
  // Docs say limit can go up to 50, but dev-mode apps get "Invalid limit" above 10; pagination via `next` covers the rest.
  let url = `${BASE_URL}/artists/${artistId}/albums?include_groups=album,single,compilation&limit=10&market=US`;

  while (url) {
    const data = await spotifyFetch(url);
    albums.push(...data.items);
    url = data.next;
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
