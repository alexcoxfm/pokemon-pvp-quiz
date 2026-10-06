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
    btn.dataset.league = cup.cp;
    btn.dataset.cup = cup.cup;
    btn.dataset.leagueName = cup.title;
    btn.innerHTML = `
      <span class="league-icon cup"></span>
      <span class="league-name">${esc(cup.title)}</span>
      <span class="league-cp">${cup.cp >= 10000 ? 'No Limit' : `CP ${esc(cup.cp)}`}</span>
    `;
    container.appendChild(btn);
  }
}

export function showLastScore(score, total, league) {
  const container = document.getElementById('session-score');
  const span = document.getElementById('last-score');
  container.classList.remove('hidden');
  span.textContent = league ? `${score}/${total} (${league})` : `${score}/${total}`;
}

export function hideCup(cup, cp) {
  const btn = document.querySelector(`#cups-buttons .league-btn[data-cup="${CSS.escape(cup)}"][data-league="${CSS.escape(String(cp))}"]`);
  btn?.remove();
  if (!document.querySelector('#cups-buttons .league-btn')) {
    document.getElementById('cups-section').classList.add('hidden');
  }
}

export function showMetaDate(timestamp) {
  const el = document.getElementById('meta-date');
  if (!el || !timestamp) return;
  const date = new Date(timestamp.replace(' ', 'T'));
  if (isNaN(date)) return;
  el.textContent = `Meta data from PvPoke · updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
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
  imgEl.style.opacity = '0';
  imgEl.onload = () => { imgEl.style.opacity = '1'; };
  imgEl.onerror = () => { imgEl.style.opacity = '0'; };
  if (imageUrl) {
    imgEl.src = imageUrl;
  } else {
    imgEl.removeAttribute('src');
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
  imgEl.src = imageUrl || '';

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

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function typeBadge(type) {
  return `<span class="type-badge type-${esc(type)}">${esc(type)}</span>`;
}

function section(label, content) {
  return `<div class="explain-label">${label}</div><div class="explain-content">${content}</div>`;
}

export function renderExplanation(explanation) {
  // Type matchup — based on the moves each Pokemon actually uses
  const typesEl = document.getElementById('explain-types');
  const typeContent = explanation.typeLines.length
    ? explanation.typeLines.map(l =>
        `${esc(l.attacker)}'s ${typeBadge(l.moveType)} <strong>${esc(l.move)}</strong> is <span class="${l.cls}">${esc(l.text)}</span> vs ${esc(l.defender)}`
      ).join('<br>')
    : '<span class="neutral">No type advantages either way — this one comes down to stats, move pressure and shields.</span>';
  typesEl.innerHTML = section('Type Matchup (recommended moves)', typeContent);

  // Rating
  const ratingEl = document.getElementById('explain-rating');
  if (explanation.rating) {
    const { winner, loser, winnerRating, loserRating } = explanation.rating;
    const isBattle = explanation.method === 'matchup';
    const scale = isBattle ? 1000 : 100;
    const bar = (name, value, cls) => `
      <div class="rating-bar">
        <span class="rating-name">${esc(name)}</span>
        <div class="rating-track"><div class="rating-bar-fill ${cls}" style="width:${Math.min(100, value / scale * 100).toFixed(0)}%"></div></div>
        <span class="rating-value">${value}</span>
      </div>`;
    const label = isBattle
      ? 'PvPoke Battle Rating <span class="explain-hint">(1v1, 500 = even)</span>'
      : 'Overall Ranking Score <span class="explain-hint">(no head-to-head data)</span>';
    ratingEl.innerHTML = section(label, bar(winner, winnerRating, 'winner-bar') + bar(loser, loserRating, 'loser-bar'));
  } else {
    ratingEl.innerHTML = section('PvPoke Battle Rating', '<span class="neutral">Dead even — 500 to 500</span>');
  }

  // Movesets for both sides
  const movesetEl = document.getElementById('explain-moveset');
  const movesetRows = explanation.sides.filter(sd => sd.moves.length).map(sd => {
    const fast = sd.moves.filter(m => m.kind === 'fast');
    const charged = sd.moves.filter(m => m.kind === 'charged');
    const tag = m => `<span class="move-tag">${m.type ? typeBadge(m.type) : ''}${esc(m.name)}</span>`;
    return `<div class="moveset-row">
      <div class="moveset-name">${esc(sd.name)}${sd.isWinner ? ' <span class="advantage">(winner)</span>' : ''}</div>
      <div class="moveset-moves">Fast: ${fast.map(tag).join(' ')}<br>Charged: ${charged.map(tag).join(' ')}</div>
    </div>`;
  });
  movesetEl.innerHTML = movesetRows.length ? section('Recommended Movesets', movesetRows.join('')) : '';

  // Dominance
  const domEl = document.getElementById('explain-dominance');
  if (explanation.dominance) {
    const levelClass = explanation.dominance.level === 'dominant' ? 'advantage' :
                       explanation.dominance.level === 'close' ? 'neutral' : '';
    domEl.innerHTML = section('Matchup Assessment', `<span class="${levelClass}">${esc(explanation.dominance.text)}</span>`);
  } else {
    domEl.innerHTML = '';
  }

  // PvPoke editor notes on the winner's role in the meta
  const notesEl = document.getElementById('explain-notes');
  if (explanation.notes) {
    notesEl.innerHTML = section(`Meta Notes: ${esc(explanation.sides[0].name)}`, esc(explanation.notes));
  } else {
    notesEl.innerHTML = '';
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
        ${esc(nameA)} vs ${esc(nameB)}
        <br><span class="round-result-winner">${round.result.method === 'toss-up' ? 'Too close to call' : `Winner: ${esc(winnerName)}`}</span>
      </div>
    `;

    roundResults.appendChild(item);
  }
}
