// app.js — Entry point, screen navigation, service worker registration

import { getGamemaster, getRankings, getFormats, getPokemonData, getMovesData, rankingsExist } from './data.js';
import { QuizSession, generateExplanation } from './quiz.js';
import {
  showScreen, renderCups, showLastScore, renderQuizHeader,
  renderPokemonCard, showQuizLoading, renderResult,
  renderExplanation, renderSummary, setPokemonMap, hideCup, showMetaDate, playRoundIntro
} from './ui.js';

let gamemaster = null;
let pokemonMap = null;
let movesMap = null;
let quizRequestId = 0;
let currentSession = null;
let lastScore = null;

// === Initialize ===

async function init() {
  registerServiceWorker();
  setupOfflineDetection();
  setupEventListeners();

  try {
    gamemaster = await getGamemaster();
    pokemonMap = getPokemonData(gamemaster);
    movesMap = getMovesData(gamemaster);
    setPokemonMap(pokemonMap);
    showMetaDate(gamemaster.timestamp);

    // Render special cups from gamemaster, then hide any PvPoke hasn't ranked
    const formats = getFormats(gamemaster);
    renderCups(formats);
    for (const f of formats) {
      rankingsExist(f.cp, f.cup).then(ok => { if (ok === false) hideCup(f.cup, f.cp); });
    }

    // Show last score if available
    try {
      const saved = JSON.parse(localStorage.getItem('lastScore'));
      if (saved) showLastScore(saved.score, saved.total, saved.league);
    } catch { /* ignore bad or unavailable storage */ }
  } catch (err) {
    console.error('Failed to load gamemaster:', err);
  }
}

// === Event Listeners ===

function setupEventListeners() {
  // League selection (home screen)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.league-btn');
    if (btn) {
      const league = btn.dataset.league;
      const cup = btn.dataset.cup || 'all';
      const leagueName = btn.dataset.leagueName;
      startQuiz(league, cup, leagueName);
    }
  });

  // Back button (quiz screen)
  document.getElementById('btn-back').addEventListener('click', () => {
    quizRequestId++; // cancel any quiz still loading
    currentSession = null;
    showScreen('screen-home');
  });

  // Pokemon card tap (quiz screen)
  document.getElementById('pokemon-a').addEventListener('click', () => {
    if (currentSession?.currentPair) {
      submitAnswer(currentSession.currentPair.pokemonA.speciesId);
    }
  });

  document.getElementById('pokemon-b').addEventListener('click', () => {
    if (currentSession?.currentPair) {
      submitAnswer(currentSession.currentPair.pokemonB.speciesId);
    }
  });

  // Next round button (result screen)
  document.getElementById('btn-next').addEventListener('click', () => {
    if (!currentSession) return;
    if (currentSession.isComplete) {
      showSummary();
    } else {
      showNextRound();
    }
  });

  // Play again (summary screen)
  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (currentSession) {
      startQuiz(
        currentSession.league,
        currentSession.cup,
        currentSession.leagueName
      );
    }
  });

  // Change league (summary screen)
  document.getElementById('btn-change-league').addEventListener('click', () => {
    currentSession = null;
    showScreen('screen-home');
  });
}

// === Quiz Flow ===

async function startQuiz(league, cup, leagueName) {
  const requestId = ++quizRequestId;
  showScreen('screen-quiz');
  showQuizLoading(true);

  try {
    if (!gamemaster) {
      // First load failed (e.g. offline on first launch) — try again now
      gamemaster = await getGamemaster();
      pokemonMap = getPokemonData(gamemaster);
      movesMap = getMovesData(gamemaster);
      setPokemonMap(pokemonMap);
    }
    const rankings = await getRankings(league, cup);
    if (requestId !== quizRequestId) return; // user backed out while loading

    const session = new QuizSession(rankings, leagueName);
    if (session.totalRounds === 0) throw new Error('No matchup data for this league');
    session.league = league;
    session.cup = cup;
    currentSession = session;
    showNextRound();
  } catch (err) {
    if (requestId !== quizRequestId) return;
    console.error('Failed to load rankings:', err);
    showQuizLoading(false);
    alert(err.status === 404
      ? `PvPoke hasn't published rankings for ${leagueName} yet.`
      : 'Failed to load league data. Check your connection and try again.');
    showScreen('screen-home');
  }
}

function showNextRound() {
  const pair = currentSession.nextRound();
  if (!pair) {
    showSummary();
    return;
  }

  renderQuizHeader(currentSession.leagueName, currentSession.currentRound, currentSession.totalRounds);
  renderPokemonCard('a', pair.pokemonA);
  renderPokemonCard('b', pair.pokemonB);
  showQuizLoading(false);

  // Re-enable cards
  document.getElementById('pokemon-a').disabled = false;
  document.getElementById('pokemon-b').disabled = false;

  showScreen('screen-quiz');
  playRoundIntro();
}

function submitAnswer(selectedSpeciesId) {
  // Prevent double-tap
  document.getElementById('pokemon-a').disabled = true;
  document.getElementById('pokemon-b').disabled = true;

  const roundData = currentSession.submitAnswer(selectedSpeciesId);
  const explanation = generateExplanation(
    roundData.result,
    roundData.pokemonA,
    roundData.pokemonB,
    pokemonMap,
    movesMap
  );

  renderResult(roundData);
  renderExplanation(explanation);

  // Update button text
  const nextBtn = document.getElementById('btn-next');
  if (currentSession.isComplete) {
    nextBtn.textContent = 'See results';
  } else {
    nextBtn.textContent = 'Next round';
  }

  showScreen('screen-result');
}

function showSummary() {
  renderSummary(currentSession);

  // Save last score
  const scoreData = {
    score: currentSession.score,
    total: currentSession.rounds.length,
    league: currentSession.leagueName,
  };
  try { localStorage.setItem('lastScore', JSON.stringify(scoreData)); } catch { /* storage unavailable */ }
  showLastScore(scoreData.score, scoreData.total, scoreData.league);

  showScreen('screen-summary');
}

// === Service Worker ===

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  }
}

// === Offline Detection ===

function setupOfflineDetection() {
  const banner = document.getElementById('offline-banner');

  function updateOnlineStatus() {
    if (navigator.onLine) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// === Start ===
init();
