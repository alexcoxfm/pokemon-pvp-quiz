// quiz.js — Pair selection, winner determination, explanation generation

import { getTypeMatchup } from './type-chart.js';

const POOL_SIZE = 100;
const ROUNDS_PER_SESSION = 10;

/**
 * Get the base species ID (strip shadow suffix) so we never pit a Pokemon
 * against its own shadow form.
 */
function baseSpeciesId(speciesId) {
  return speciesId.replace(/_shadow$/, '');
}

function pairKey(idA, idB) {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/**
 * Build an index of every head-to-head result PvPoke published for the pool.
 *
 * In PvPoke's rankings, each entry's `matchups` (best wins) and `counters`
 * (worst losses) carry a battle rating from THAT entry's point of view:
 * > 500 means it wins, < 500 means it loses, 500 is a draw.
 */
export function buildMatchupIndex(pool) {
  const ids = new Set(pool.map(p => p.speciesId));
  const index = new Map();

  for (const p of pool) {
    for (const m of [...(p.matchups || []), ...(p.counters || [])]) {
      if (!ids.has(m.opponent) || m.opponent === p.speciesId) continue;
      if (baseSpeciesId(m.opponent) === baseSpeciesId(p.speciesId)) continue;
      const key = pairKey(p.speciesId, m.opponent);
      if (index.has(key)) continue;
      index.set(key, { from: p.speciesId, opponent: m.opponent, rating: m.rating });
    }
  }
  return index;
}

/**
 * Select a quiz pair that has real head-to-head data, avoiding Pokemon
 * already used this session when possible.
 */
export function selectQuizPair(pool, index, usedPokemon = new Set()) {
  const byId = new Map(pool.map(p => [p.speciesId, p]));
  const entries = [...index.values()];
  if (entries.length === 0) return null;

  let candidates = entries.filter(e => !usedPokemon.has(e.from) && !usedPokemon.has(e.opponent));
  if (candidates.length === 0) candidates = entries;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  // Randomize which side each Pokemon appears on
  const [idA, idB] = Math.random() < 0.5 ? [pick.from, pick.opponent] : [pick.opponent, pick.from];
  return { pokemonA: byId.get(idA), pokemonB: byId.get(idB) };
}

/**
 * Determine the winner between two Pokemon using PvPoke head-to-head data.
 * Returns { winner, loser, winnerRating, loserRating, method }
 * winnerRating/loserRating are battle ratings (0–1000) that sum to 1000.
 */
export function determineWinner(pokemonA, pokemonB) {
  const lookups = [
    [pokemonA, pokemonB],
    [pokemonB, pokemonA],
  ];

  for (const [self, other] of lookups) {
    const entry = [...(self.matchups || []), ...(self.counters || [])]
      .find(m => m.opponent === other.speciesId);
    if (!entry) continue;

    if (entry.rating === 500) {
      return { winner: null, loser: null, winnerRating: 500, loserRating: 500, method: 'toss-up' };
    }
    const selfWins = entry.rating > 500;
    return {
      winner: selfWins ? self : other,
      loser: selfWins ? other : self,
      winnerRating: selfWins ? entry.rating : 1000 - entry.rating,
      loserRating: selfWins ? 1000 - entry.rating : entry.rating,
      method: 'matchup',
    };
  }

  // No head-to-head data (shouldn't happen with selectQuizPair): fall back to
  // overall ranking score, which is NOT a head-to-head result.
  const scoreA = pokemonA.score || 0;
  const scoreB = pokemonB.score || 0;
  if (Math.abs(scoreA - scoreB) < 1) {
    return { winner: null, loser: null, winnerRating: scoreA, loserRating: scoreB, method: 'toss-up' };
  }
  const aWins = scoreA > scoreB;
  return {
    winner: aWins ? pokemonA : pokemonB,
    loser: aWins ? pokemonB : pokemonA,
    winnerRating: Math.max(scoreA, scoreB),
    loserRating: Math.min(scoreA, scoreB),
    method: 'score',
  };
}

/**
 * Describe how dominant a matchup is, from the winner's battle rating.
 */
function describeDominance(winnerRating) {
  if (winnerRating >= 800) return { text: 'Dominant victory', level: 'dominant' };
  if (winnerRating >= 650) return { text: 'Solid win', level: 'solid' };
  if (winnerRating >= 550) return { text: 'Close matchup', level: 'close' };
  return { text: 'Very close battle — shields and timing decide it', level: 'close' };
}

function effectivenessLabel(mult) {
  if (mult >= 2.5) return { text: 'double super effective', cls: 'advantage' };
  if (mult > 1) return { text: 'super effective', cls: 'advantage' };
  if (mult <= 0.25) return { text: 'barely scratches', cls: 'disadvantage' };
  if (mult <= 0.4) return { text: 'double resisted', cls: 'disadvantage' };
  if (mult < 1) return { text: 'resisted', cls: 'disadvantage' };
  return { text: 'neutral', cls: 'neutral' };
}

/**
 * Resolve a PvPoke ranking entry's recommended moveset into move objects.
 */
function resolveMoveset(entry, movesMap) {
  return (entry.moveset || []).map((moveId, i) => {
    const move = movesMap?.get(moveId);
    return {
      id: moveId,
      name: move?.name || prettifyMoveId(moveId),
      type: move?.type || null,
      kind: i === 0 ? 'fast' : 'charged',
    };
  });
}

function prettifyMoveId(id) {
  return id.toLowerCase().split('_').map(capitalize).join(' ');
}

function typesOf(entry, pokemonMap) {
  const data = pokemonMap?.get(entry.speciesId);
  return (data?.types || []).filter(t => t && t !== 'none');
}

/**
 * Generate explanation for a quiz result.
 * Returns plain data; ui.js handles markup.
 */
export function generateExplanation(result, pokemonA, pokemonB, pokemonMap, movesMap) {
  const first = result.winner || pokemonA;
  const second = result.loser || pokemonB;

  const sides = [first, second].map(entry => ({
    speciesId: entry.speciesId,
    name: entry.speciesName || entry.speciesId,
    types: typesOf(entry, pokemonMap),
    moves: resolveMoveset(entry, movesMap),
    isWinner: result.winner?.speciesId === entry.speciesId,
  }));

  // How each side's actual moves land on the other side's typing
  const typeLines = [];
  for (const [atk, def] of [[sides[0], sides[1]], [sides[1], sides[0]]]) {
    if (!def.types.length) continue;
    for (const move of atk.moves) {
      if (!move.type) continue;
      const mult = getTypeMatchup(move.type, def.types);
      if (mult === 1) continue;
      typeLines.push({ attacker: atk.name, move: move.name, moveType: move.type, defender: def.name, ...effectivenessLabel(mult) });
    }
  }

  const explanation = {
    method: result.method,
    sides,
    typeLines,
    rating: null,
    dominance: null,
    notes: first.editorNotes || null,
  };

  if (result.method !== 'toss-up') {
    explanation.rating = {
      winner: sides[0].name,
      loser: sides[1].name,
      winnerRating: Math.round(result.winnerRating),
      loserRating: Math.round(result.loserRating),
    };
    if (result.method === 'matchup') {
      explanation.dominance = describeDominance(result.winnerRating);
    }
  }

  return explanation;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Quiz session manager.
 */
export class QuizSession {
  constructor(rankings, leagueName) {
    this.pool = rankings.slice(0, POOL_SIZE);
    this.index = buildMatchupIndex(this.pool);
    this.leagueName = leagueName;
    this.rounds = [];
    this.usedPokemon = new Set();
    this.currentRound = 0;
    this.totalRounds = Math.min(ROUNDS_PER_SESSION, this.index.size);
    this.currentPair = null;
    this.currentResult = null;
  }

  get isComplete() {
    return this.currentRound >= this.totalRounds;
  }

  get score() {
    return this.rounds.filter(r => r.correct).length;
  }

  nextRound() {
    if (this.isComplete) return null;

    const pair = selectQuizPair(this.pool, this.index, this.usedPokemon);
    if (!pair) return null;

    this.currentRound++;
    this.currentPair = pair;
    this.usedPokemon.add(pair.pokemonA.speciesId);
    this.usedPokemon.add(pair.pokemonB.speciesId);
    this.currentResult = determineWinner(pair.pokemonA, pair.pokemonB);

    return pair;
  }

  submitAnswer(selectedSpeciesId) {
    const result = this.currentResult;
    // Either answer is acceptable for a draw
    const correct = result.method === 'toss-up' || result.winner.speciesId === selectedSpeciesId;

    const roundData = {
      round: this.currentRound,
      pokemonA: this.currentPair.pokemonA,
      pokemonB: this.currentPair.pokemonB,
      result,
      selected: selectedSpeciesId,
      correct,
    };

    this.rounds.push(roundData);
    return roundData;
  }
}
