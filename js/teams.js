// teams.js — Build balanced 3-Pokemon team ideas from PvPoke rankings
//
// How it works (all from live PvPoke data, nothing hardcoded):
// 1. Candidates are the top-ranked Pokemon in the league; threats are the
//    top of the meta you're likely to face.
// 2. For every candidate vs threat we use PvPoke's own head-to-head battle
//    rating when it's published (each Pokemon's best wins and worst losses).
//    Otherwise we estimate from types: who hits harder with their
//    recommended moves.
// 3. Every 3-Pokemon combo is scored: how well the team answers each threat,
//    minus a penalty when two or more members lose to the same threat
//    (a shared weakness), plus the members' own ranking scores.
// 4. Roles (lead / switch / closer) come from PvPoke's scenario scores.

import { getTypeMatchup } from './type-chart.js';

const CANDIDATES = 40;
const THREATS = 30;
const ANCHORS = 14;
const TEAMS_TO_SHOW = 6;

// PvPoke `scores` order: leads, closers, switches, chargers, attackers, consistency
const ROLE_SCORE_INDEX = { Lead: 0, Switch: 2, Closer: 1 };
const ROLE_ORDER = ['Lead', 'Switch', 'Closer'];

const PER_ANCHOR = 60;
const MAX_APPEARANCES = 2;
const KNOWN_WEIGHT = 1;
const ESTIMATE_WEIGHT = 0.45;

function prepare(entry, pokemonMap, movesMap) {
  const data = pokemonMap.get(entry.speciesId);
  // GO Battle League doesn't allow two of the same species (same Pokedex
  // number), so Shadow/regional/other forms count as duplicates.
  const base = data?.dex ? `dex${data.dex}` : entry.speciesId.replace(/_shadow$/, '');
  const types = (data?.types || []).filter(t => t && t !== 'none');
  const moves = (entry.moveset || []).map((id, i) => {
    const m = movesMap.get(id);
    return { id, name: m?.name || id, type: m?.type || null, kind: i === 0 ? 'fast' : 'charged' };
  });
  return { entry, id: entry.speciesId, base, name: entry.speciesName || entry.speciesId, types, moves };
}

function buildKnownRatings(rankings) {
  // key "a|b" -> battle rating from a's point of view
  const known = new Map();
  for (const p of rankings) {
    for (const m of [...(p.matchups || []), ...(p.counters || [])]) {
      known.set(`${p.speciesId}|${m.opponent}`, m.rating);
      if (!known.has(`${m.opponent}|${p.speciesId}`)) {
        known.set(`${m.opponent}|${p.speciesId}`, 1000 - m.rating);
      }
    }
  }
  return known;
}

function bestHit(attacker, defender) {
  let best = 1;
  for (const move of attacker.moves) {
    if (!move.type || !defender.types.length) continue;
    best = Math.max(best, getTypeMatchup(move.type, defender.types));
  }
  return best;
}

/**
 * How `a` fares against `t`, from -1 (loses badly) to +1 (wins big).
 * Returns { value, known }.
 */
function matchupValue(a, t, known) {
  const rating = known.get(`${a.id}|${t.id}`);
  if (rating !== undefined) {
    return { value: Math.max(-1, Math.min(1, (rating - 500) / 300)), known: true };
  }
  const offense = bestHit(a, t);
  const defense = bestHit(t, a);
  let value = 0;
  if (offense > defense) value = offense / defense >= 2.5 ? 1 : 0.6;
  else if (defense > offense) value = defense / offense >= 2.5 ? -1 : -0.6;
  return { value: value * ESTIMATE_WEIGHT / KNOWN_WEIGHT, known: false };
}

function assignRoles(members) {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best = null;
  for (const perm of perms) {
    const total = perm.reduce((sum, mi, ri) => sum + (members[mi].entry.scores?.[ROLE_SCORE_INDEX[ROLE_ORDER[ri]]] || 0), 0);
    if (!best || total > best.total) best = { perm, total };
  }
  return best.perm.map((mi, ri) => ({ ...members[mi], role: ROLE_ORDER[ri] }));
}

/**
 * Build team ideas for one league.
 * @returns {Array<{ members, handles, threatCount, weakTo, score }>}
 */
export function buildTeams(rankings, pokemonMap, movesMap) {
  const candidates = rankings.slice(0, CANDIDATES).map(e => prepare(e, pokemonMap, movesMap));
  const threats = rankings.slice(0, THREATS).map(e => prepare(e, pokemonMap, movesMap));
  const known = buildKnownRatings(rankings);

  // Top of the meta matters most
  const weights = threats.map((_, i) => 1 - i / (THREATS * 2));

  // Precompute candidate x threat values
  const values = candidates.map(c => threats.map(t => (c.base === t.base ? null : matchupValue(c, t, known))));

  function scoreTeam(idx) {
    const members = idx.map(i => candidates[i]);
    let score = 0;
    let handles = 0;
    let threatCount = 0;
    const weakTo = [];

    threats.forEach((t, ti) => {
      if (members.some(m => m.base === t.base)) return; // a threat on your own team isn't a threat
      threatCount++;
      const vs = idx.map(i => values[i][ti]?.value ?? 0);
      const best = Math.max(...vs);
      const losers = vs.filter(v => v < -0.15).length;
      score += weights[ti] * best;
      if (best > 0.1) handles++;
      if (losers >= 2) {
        score -= weights[ti] * 0.5 * (losers - 1);
        weakTo.push(t);
      }
    });

    // Strong Pokemon are strong for a reason
    score += members.reduce((s, m) => s + (m.entry.score || 0), 0) / 100;

    // Shared types stack weaknesses
    const typeCounts = {};
    for (const m of members) for (const ty of m.types) typeCounts[ty] = (typeCounts[ty] || 0) + 1;
    for (const n of Object.values(typeCounts)) if (n > 1) score -= 0.6 * (n - 1);

    return { score, handles, threatCount, weakTo };
  }

  // For each anchor among the very top, keep its best few partner pairs
  const results = new Map();
  const anchorCount = Math.min(ANCHORS, candidates.length);
  for (let a = 0; a < anchorCount; a++) {
    const top = [];
    for (let b = 0; b < candidates.length; b++) {
      if (b === a || candidates[b].base === candidates[a].base) continue;
      for (let c = b + 1; c < candidates.length; c++) {
        if (c === a || candidates[c].base === candidates[a].base || candidates[c].base === candidates[b].base) continue;
        const idx = [a, b, c];
        const s = scoreTeam(idx);
        if (top.length < PER_ANCHOR || s.score > top[top.length - 1].score) {
          top.push({ idx, ...s });
          top.sort((x, y) => y.score - x.score);
          if (top.length > PER_ANCHOR) top.pop();
        }
      }
    }
    for (const t of top) results.set([...t.idx].sort((x, y) => x - y).join(','), t);
  }

  // Keep the best, but make sure the list shows variety: no two teams share
  // two members, and no Pokemon shows up in more than two teams
  const sorted = [...results.values()].sort((x, y) => y.score - x.score);
  const chosen = [];
  const appearances = new Map();
  for (const r of sorted) {
    const key = new Set(r.idx);
    if (chosen.some(c => c.idx.filter(i => key.has(i)).length >= 2)) continue;
    if (r.idx.some(i => (appearances.get(i) || 0) >= MAX_APPEARANCES)) continue;
    chosen.push(r);
    for (const i of r.idx) appearances.set(i, (appearances.get(i) || 0) + 1);
    if (chosen.length >= TEAMS_TO_SHOW) break;
  }

  return chosen.map(r => {
    const members = assignRoles(r.idx.map(i => {
      const m = candidates[i];
      // Which top threats this member answers, PvPoke-confirmed results first
      const beats = threats
        .map((t, ti) => ({ t, v: values[i][ti] }))
        .filter(x => x.v && x.v.value > 0.1)
        .sort((x, y) => (y.v.known - x.v.known) || (y.v.value - x.v.value))
        .slice(0, 3)
        .map(x => x.t.name);
      return { ...m, beats };
    }));
    return {
      members,
      handles: r.handles,
      threatCount: r.threatCount,
      weakTo: r.weakTo.slice(0, 3).map(t => t.name),
      score: r.score,
    };
  });
}
