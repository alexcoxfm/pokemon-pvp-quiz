// quiz.js — Pair selection, winner determination, explanation generation

import { analyzeTypeMatchup } from './type-chart.js';

const POOL_SIZE = 100;
const ROUNDS_PER_SESSION = 10;

/**
 * Get the base species ID (strip shadow, _b suffixes).
 */
function baseSpeciesId(speciesId) {
  return speciesId.replace(/_shadow$/, '').replace(/_b$/, '');
}

/**
 * Select a quiz pair from the rankings pool.
 * Prefers picking Pokemon B from A's matchups/counters for data-rich pairings.
 */
export function selectQuizPair(rankings, usedPokemon = new Set()) {
  const pool = rankings.slice(0, POOL_SIZE);

  // Filter out already-used Pokemon
  const available = pool.filter(p => !usedPokemon.has(p.speciesId));
  if (available.length < 2) {
    // Reset if we've used too many
    return selectQuizPair(rankings, new Set());
  }

  // Pick Pokemon A randomly
  const idxA = Math.floor(Math.random() * available.length);
  const pokemonA = available[idxA];

  // Try to pick B from A's matchups or counters
  let pokemonB = null;
  const baseA = baseSpeciesId(pokemonA.speciesId);

  // Combine matchups and counters for candidate pool
  const relatedIds = new Set();
  if (pokemonA.matchups) {
    for (const m of pokemonA.matchups) {
      relatedIds.add(m.opponent);
    }
  }
  if (pokemonA.counters) {
    for (const c of pokemonA.counters) {
      relatedIds.add(c.opponent);
    }
  }

  // Filter related to those in our pool and not used
  const relatedInPool = available.filter(p =>
    p.speciesId !== pokemonA.speciesId &&
    relatedIds.has(p.speciesId) &&
    baseSpeciesId(p.speciesId) !== baseA
  );

  if (relatedInPool.length > 0) {
    pokemonB = relatedInPool[Math.floor(Math.random() * relatedInPool.length)];
  }

  // Fallback: random different Pokemon from pool
  if (!pokemonB) {
    const candidates = available.filter(p =>
      p.speciesId !== pokemonA.speciesId &&
      baseSpeciesId(p.speciesId) !== baseA
    );
    if (candidates.length > 0) {
      pokemonB = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // Last resort: just pick the next different Pokemon
      pokemonB = available.find(p => p.speciesId !== pokemonA.speciesId) || available[1] || available[0];
    }
  }

  return { pokemonA, pokemonB };
}

/**
 * Determine the winner between two Pokemon using rankings data.
 * Returns { winner, loser, rating, method }
 */
export function determineWinner(pokemonA, pokemonB) {
  // Check A's matchups for B (A wins)
  if (pokemonA.matchups) {
    const matchup = pokemonA.matchups.find(m => m.opponent === pokemonB.speciesId);
    if (matchup) {
      return {
        winner: pokemonA,
        loser: pokemonB,
        winnerRating: matchup.rating,
        loserRating: 1000 - matchup.rating,
        method: 'matchup'
      };
    }
  }

  // Check A's counters for B (B wins)
  if (pokemonA.counters) {
    const counter = pokemonA.counters.find(c => c.opponent === pokemonB.speciesId);
    if (counter) {
      return {
        winner: pokemonB,
        loser: pokemonA,
        winnerRating: counter.rating,
        loserRating: 1000 - counter.rating,
        method: 'counter'
      };
    }
  }

  // Check B's matchups for A (B wins)
  if (pokemonB.matchups) {
    const matchup = pokemonB.matchups.find(m => m.opponent === pokemonA.speciesId);
    if (matchup) {
      return {
        winner: pokemonB,
        loser: pokemonA,
        winnerRating: matchup.rating,
        loserRating: 1000 - matchup.rating,
        method: 'matchup'
      };
    }
  }

  // Check B's counters for A (A wins)
  if (pokemonB.counters) {
    const counter = pokemonB.counters.find(c => c.opponent === pokemonA.speciesId);
    if (counter) {
      return {
        winner: pokemonA,
        loser: pokemonB,
        winnerRating: counter.rating,
        loserRating: 1000 - counter.rating,
        method: 'counter'
      };
    }
  }

  // Fallback: compare overall ratings
  const ratingA = pokemonA.rating || 0;
  const ratingB = pokemonB.rating || 0;

  if (Math.abs(ratingA - ratingB) < 1) {
    // Too close to call
    return {
      winner: null,
      loser: null,
      winnerRating: ratingA,
      loserRating: ratingB,
      method: 'toss-up'
    };
  }

  const aWins = ratingA >= ratingB;
  return {
    winner: aWins ? pokemonA : pokemonB,
    loser: aWins ? pokemonB : pokemonA,
    winnerRating: Math.max(ratingA, ratingB),
    loserRating: Math.min(ratingA, ratingB),
    method: 'rating'
  };
}

/**
 * Describe how dominant a matchup is.
 */
function describeDominance(winnerRating) {
  if (winnerRating >= 900) return { text: 'Dominant victory', level: 'dominant' };
  if (winnerRating >= 700) return { text: 'Solid win', level: 'solid' };
  if (winnerRating >= 550) return { text: 'Close matchup', level: 'close' };
  return { text: 'Very close battle', level: 'close' };
}

/**
 * Generate explanation for a quiz result.
 */
export function generateExplanation(result, pokemonA, pokemonB, pokemonMap) {
  const explanation = {
    types: '',
    rating: null,
    moveset: '',
    dominance: null,
  };

  // Get type data from gamemaster
  const dataA = pokemonMap?.get(pokemonA.speciesId);
  const dataB = pokemonMap?.get(pokemonB.speciesId);

  // Type analysis
  if (dataA?.types && dataB?.types) {
    const typesA = dataA.types.filter(Boolean);
    const typesB = dataB.types.filter(Boolean);
    const analysis = analyzeTypeMatchup(typesA, typesB);

    const lines = [];

    for (const adv of analysis.advantages) {
      const attacker = adv.side === 'A' ? pokemonA : pokemonB;
      const defender = adv.side === 'A' ? pokemonB : pokemonA;
      const attackerName = attacker.speciesName || attacker.speciesId;
      const defenderName = defender.speciesName || defender.speciesId;
      const mult = adv.multiplier >= 2.5 ? 'double super effective' : 'super effective';
      lines.push(`<span class="advantage">${capitalize(adv.type)}</span> is ${mult} against ${defenderName}`);
    }

    for (const dis of analysis.disadvantages) {
      const attacker = dis.side === 'A' ? pokemonA : pokemonB;
      const mult = dis.multiplier <= 0.4 ? 'double resisted' : 'resisted';
      lines.push(`<span class="disadvantage">${capitalize(dis.type)}</span> is ${mult} by the opponent`);
    }

    if (lines.length === 0) {
      lines.push('<span class="neutral">No significant type advantages</span>');
    }

    explanation.types = lines.join('<br>');
  }

  // Rating data
  if (result.method !== 'toss-up' && result.winnerRating) {
    explanation.rating = {
      winner: result.winner.speciesName || result.winner.speciesId,
      loser: result.loser.speciesName || result.loser.speciesId,
      winnerRating: Math.round(result.winnerRating),
      loserRating: Math.round(result.loserRating),
    };
  }

  // Winner's moveset
  if (result.winner?.moveset) {
    const moves = result.winner.moveset;
    const moveParts = [];
    if (moves.length > 0) moveParts.push(`Fast: <span class="move-tag">${moves[0]}</span>`);
    if (moves.length > 1) moveParts.push(`Charged: <span class="move-tag">${moves[1]}</span>`);
    if (moves.length > 2) moveParts.push(`<span class="move-tag">${moves[2]}</span>`);
    explanation.moveset = moveParts.join(' ');
  }

  // Dominance level
  if (result.method !== 'toss-up') {
    explanation.dominance = describeDominance(result.winnerRating);
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
    this.rankings = rankings;
    this.leagueName = leagueName;
    this.rounds = [];
    this.usedPokemon = new Set();
    this.currentRound = 0;
    this.totalRounds = Math.min(ROUNDS_PER_SESSION, Math.floor(rankings.slice(0, POOL_SIZE).length / 2));
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

    this.currentRound++;
    const pair = selectQuizPair(this.rankings, this.usedPokemon);
    this.currentPair = pair;

    // Mark as used
    this.usedPokemon.add(pair.pokemonA.speciesId);
    this.usedPokemon.add(pair.pokemonB.speciesId);

    // Pre-calculate the winner
    this.currentResult = determineWinner(pair.pokemonA, pair.pokemonB);

    return pair;
  }

  submitAnswer(selectedSpeciesId) {
    const result = this.currentResult;
    let correct;

    if (result.method === 'toss-up') {
      // Either answer is acceptable for toss-ups
      correct = true;
    } else {
      correct = result.winner.speciesId === selectedSpeciesId;
    }

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
