// ui.js — DOM rendering for all screens

import { getImageUrl, getDisplayName } from './pokemon-mapper.js';

let pokemonMap = null;

export function setPokemonMap(map) {
  pokemonMap = map;
}

// === Screen Navigation ===

const screens = ['screen-home', 'screen-quiz', 'screen-result', 'screen-summary'];

export function showScreen(screenId) {
  for (const id of screens) {
    const el = document.getElementById(id);
    el.classList.remove('active');
  }
  // Small delay for transition effect
  requestAnimationFrame(() => {
    const target = document.getElementById(screenId);
    target.classList.add('active');
    target.scrollTop = 0;
    window.scrollTo(0, 0);
  });
}

// === Home Screen ===

export function renderCups(formats) {
  const section = document.getElementById('cups-section');
  const container = document.getElementById('cups-buttons');

  const cups = formats.filter(f => f.title && f.cup);
  if (cups.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = '';

  for (const cup of cups) {
    const btn = document.createElement('button');
    btn.className = 'league-btn';
    btn.dataset.league = cup.cp || '1500';
    btn.dataset.cup = cup.cup || 'all';
    btn.dataset.leagueName = cup.title;
    btn.innerHTML = `
      <span class="league-icon cup"></span>
      <span class="league-name">${cup.title}</span>
      <span class="league-cp">CP ${cup.cp || '1500'}</span>
    `;
    container.appendChild(btn);
  }
}

export function showLastScore(score, total) {
  const container = document.getElementById('session-score');
  const span = document.getElementById('last-score');
  container.classList.remove('hidden');
  span.textContent = `${score}/${total}`;
}

// === Quiz Screen ===

export function renderQuizHeader(leagueName, round, totalRounds) {
  document.getElementById('quiz-league-name').textContent = leagueName;
  document.getElementById('quiz-round').textContent = `Round ${round} of ${totalRounds}`;
}

export function renderPokemonCard(side, pokemon) {
  const prefix = side === 'a' ? 'pokemon-a' : 'pokemon-b';
  const imgEl = document.getElementById(`${prefix}-img`);
  const nameEl = document.getElementById(`${prefix}-name`);
  const typesEl = document.getElementById(`${prefix}-types`);

  const name = getDisplayName(pokemon.speciesId, pokemonMap);
  const imageUrl = getImageUrl(pokemon.speciesId, pokemonMap);

  nameEl.textContent = name;
  imgEl.alt = name;

  // Image loading
  imgEl.src = '';
  imgEl.style.opacity = '0';
  if (imageUrl) {
    imgEl.src = imageUrl;
    imgEl.onload = () => { imgEl.style.opacity = '1'; };
    imgEl.onerror = () => { imgEl.style.opacity = '0'; };
  }

  // Type badges
  typesEl.innerHTML = '';
  const pokeData = pokemonMap?.get(pokemon.speciesId);
  if (pokeData?.types) {
    for (const type of pokeData.types) {
      if (!type || type === 'none') continue;
      const badge = document.createElement('span');
      badge.className = `type-badge type-${type.toLowerCase()}`;
      badge.textContent = type;
      typesEl.appendChild(badge);
    }
  }
}

export function showQuizLoading(show) {
  const loading = document.getElementById('loading-quiz');
  const matchup = document.querySelector('.pokemon-matchup');
  const prompt = document.querySelector('.quiz-prompt');

  if (show) {
    loading.classList.remove('hidden');
    matchup.style.display = 'none';
    prompt.style.display = 'none';
  } else {
    loading.classList.add('hidden');
    matchup.style.display = '';
    prompt.style.display = '';
  }
}

// === Result Screen ===

export function renderResult(roundData) {
  const { pokemonA, pokemonB, result, correct } = roundData;
  const banner = document.getElementById('result-banner');
  const resultText = document.getElementById('result-text');

  // Banner
  banner.className = 'result-banner';
  if (result.method === 'toss-up') {
    banner.classList.add('toss-up');
    resultText.textContent = 'Too close to call!';
  } else if (correct) {
    banner.classList.add('correct');
    resultText.textContent = 'Correct!';
  } else {
    banner.classList.add('wrong');
    resultText.textContent = 'Wrong!';
  }

  // Pokemon A
  renderResultPokemon('a', pokemonA, result);
  // Pokemon B
  renderResultPokemon('b', pokemonB, result);
}

function renderResultPokemon(side, pokemon, result) {
  const prefix = `result-${side}`;
  const container = document.getElementById(`result-pokemon-${side}`);
  const imgEl = document.getElementById(`${prefix}-img`);
  const nameEl = document.getElementById(`${prefix}-name`);
  const typesEl = document.getElementById(`${prefix}-types`);

  const name = getDisplayName(pokemon.speciesId, pokemonMap);
  const imageUrl = getImageUrl(pokemon.speciesId, pokemonMap);

  nameEl.textContent = name;
  imgEl.alt = name;
  if (imageUrl) {
    imgEl.src = imageUrl;
  }

  // Type badges
  typesEl.innerHTML = '';
  const pokeData = pokemonMap?.get(pokemon.speciesId);
  if (pokeData?.types) {
    for (const type of pokeData.types) {
      if (!type || type === 'none') continue;
      const badge = document.createElement('span');
      badge.className = `type-badge type-${type.toLowerCase()}`;
      badge.textContent = type;
      typesEl.appendChild(badge);
    }
  }

  // Highlight winner/loser
  container.className = 'result-pokemon';
  if (result.method !== 'toss-up') {
    if (result.winner.speciesId === pokemon.speciesId) {
      container.classList.add('winner');
    } else {
      container.classList.add('loser');
    }
  }
}

export function renderExplanation(explanation) {
  // Types
  const typesEl = document.getElementById('explain-types');
  if (explanation.types) {
    typesEl.innerHTML = `
      <div class="explain-label">Type Matchup</div>
      <div class="explain-content">${explanation.types}</div>
    `;
  } else {
    typesEl.innerHTML = '';
  }

  // Rating
  const ratingEl = document.getElementById('explain-rating');
  if (explanation.rating) {
    const { winner, loser, winnerRating, loserRating } = explanation.rating;
    const maxRating = Math.max(winnerRating, loserRating, 1);
    const winnerPct = (winnerRating / 1000 * 100).toFixed(0);
    const loserPct = (loserRating / 1000 * 100).toFixed(0);

    ratingEl.innerHTML = `
      <div class="explain-label">Battle Rating</div>
      <div class="explain-content">
        <div class="rating-bar">
          <span style="min-width:80px;font-size:0.8rem">${winner}</span>
          <div class="rating-bar-fill winner-bar" style="width:${winnerPct}%"></div>
          <span class="rating-value">${winnerRating}</span>
        </div>
        <div class="rating-bar">
          <span style="min-width:80px;font-size:0.8rem">${loser}</span>
          <div class="rating-bar-fill loser-bar" style="width:${loserPct}%"></div>
          <span class="rating-value">${loserRating}</span>
        </div>
      </div>
    `;
  } else {
    ratingEl.innerHTML = '';
  }

  // Moveset
  const movesetEl = document.getElementById('explain-moveset');
  if (explanation.moveset) {
    const winnerName = explanation.rating?.winner || 'Winner';
    movesetEl.innerHTML = `
      <div class="explain-label">${winnerName}'s Recommended Moveset</div>
      <div class="explain-content">${explanation.moveset}</div>
    `;
  } else {
    movesetEl.innerHTML = '';
  }

  // Dominance
  const domEl = document.getElementById('explain-dominance');
  if (explanation.dominance) {
    const levelClass = explanation.dominance.level === 'dominant' ? 'advantage' :
                       explanation.dominance.level === 'close' ? 'neutral' : '';
    domEl.innerHTML = `
      <div class="explain-label">Matchup Assessment</div>
      <div class="explain-content"><span class="${levelClass}">${explanation.dominance.text}</span></div>
    `;
  } else {
    domEl.innerHTML = '';
  }
}

// === Summary Screen ===

export function renderSummary(session) {
  const finalScore = document.getElementById('final-score');
  finalScore.textContent = `${session.score} / ${session.totalRounds}`;

  const roundResults = document.getElementById('round-results');
  roundResults.innerHTML = '';

  for (const round of session.rounds) {
    const item = document.createElement('div');
    item.className = 'round-result-item';

    const nameA = getDisplayName(round.pokemonA.speciesId, pokemonMap);
    const nameB = getDisplayName(round.pokemonB.speciesId, pokemonMap);
    const winnerName = round.result.method === 'toss-up'
      ? 'Toss-up'
      : getDisplayName(round.result.winner.speciesId, pokemonMap);

    item.innerHTML = `
      <div class="round-result-icon ${round.correct ? 'correct' : 'wrong'}">
        ${round.correct ? '\u2713' : '\u2717'}
      </div>
      <div class="round-result-text">
        ${nameA} vs ${nameB}
        <br><span class="round-result-winner">${round.result.method === 'toss-up' ? 'Too close to call' : `Winner: ${winnerName}`}</span>
      </div>
    `;

    roundResults.appendChild(item);
  }
}
