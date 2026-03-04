// data.js — Fetch gamemaster + rankings, IndexedDB caching

const DB_NAME = 'pvp-quiz';
const DB_VERSION = 1;
const STORE_NAME = 'data';
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

const BASE_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data';
const GAMEMASTER_URL = `${BASE_URL}/gamemaster.json`;

function rankingsUrl(league, cup = 'all') {
  return `${BASE_URL}/rankings/${cup}/overall/rankings-${league}.json`;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCached(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setCache(key, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, timestamp: Date.now() }, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache write failed, non-critical
  }
}

async function fetchWithCache(url, key) {
  const cached = await getCached(key);
  const isStale = !cached || (Date.now() - cached.timestamp > STALE_MS);

  if (cached && !isStale) {
    return cached.data;
  }

  // Serve stale immediately, refresh in background
  if (cached && isStale) {
    fetchAndUpdate(url, key);
    return cached.data;
  }

  // No cache at all — must fetch
  return fetchAndUpdate(url, key);
}

async function fetchAndUpdate(url, key) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const data = await response.json();
  await setCache(key, data);
  return data;
}

export async function getGamemaster() {
  return fetchWithCache(GAMEMASTER_URL, 'gamemaster');
}

export async function getRankings(league, cup = 'all') {
  const key = `rankings-${cup}-${league}`;

  if (cup !== 'all') {
    try {
      return await fetchWithCache(rankingsUrl(league, cup), key);
    } catch {
      // Cup-specific rankings don't exist, fall back to general
      return fetchWithCache(rankingsUrl(league, 'all'), `rankings-all-${league}`);
    }
  }

  return fetchWithCache(rankingsUrl(league, 'all'), key);
}

export function getFormats(gamemaster) {
  // Extract active cup/format definitions from gamemaster
  if (!gamemaster || !gamemaster.formats) return [];
  return gamemaster.formats.filter(f => f.league && f.title);
}

export function getPokemonData(gamemaster) {
  // Build a map of speciesId -> pokemon data from gamemaster
  const map = new Map();
  if (!gamemaster || !gamemaster.pokemon) return map;

  for (const poke of gamemaster.pokemon) {
    map.set(poke.speciesId, poke);
  }
  return map;
}

export function getMoveData(gamemaster) {
  // Build a map of moveId -> display name from gamemaster
  const map = new Map();
  if (!gamemaster || !gamemaster.moves) return map;

  for (const move of gamemaster.moves) {
    if (move.moveId && move.name) {
      map.set(move.moveId, move.name);
    }
  }
  return map;
}
