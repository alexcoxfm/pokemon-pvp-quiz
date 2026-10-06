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
    fetchAndUpdate(url, key).catch(() => { /* offline — keep using cache */ });
    return cached.data;
  }

  // No cache at all — must fetch
  return fetchAndUpdate(url, key);
}

async function fetchAndUpdate(url, key) {
  // Bypass the HTTP cache so a 24h refresh actually gets PvPoke's latest data
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    const err = new Error(`Failed to fetch ${url}: ${response.status}`);
    err.status = response.status;
    throw err;
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

  // Cup rankings that PvPoke hasn't published 404 — let that error surface
  // rather than silently quizzing on the open league under the cup's name.
  return fetchWithCache(rankingsUrl(league, cup), key);
}

/**
 * Check whether PvPoke has published rankings for a cup.
 * Resolves true/false, or null if we couldn't tell (offline).
 */
export async function rankingsExist(league, cup) {
  if (await getCached(`rankings-${cup}-${league}`)) return true;
  try {
    const res = await fetch(rankingsUrl(league, cup), { method: 'HEAD' });
    return res.ok;
  } catch {
    return null;
  }
}

export function getFormats(gamemaster) {
  // Active cups/formats PvPoke currently lists. Entries look like
  // { title, cup, cp, showFormat, hideRankings }.
  if (!gamemaster || !gamemaster.formats) return [];
  const seen = new Set();
  return gamemaster.formats.filter(f => {
    if (!f.title || !f.cup || !f.cp) return false;
    if (f.cup === 'all' || f.cup === 'custom') return false; // open leagues have their own buttons
    if (f.showFormat === false || f.hideRankings) return false;
    const key = `${f.cup}-${f.cp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getMovesData(gamemaster) {
  // moveId -> { name, type, ... }
  const map = new Map();
  for (const move of gamemaster?.moves || []) {
    map.set(move.moveId, move);
  }
  return map;
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
