// app.js — Entry point, screen navigation, service worker registration

import { getGamemaster, getRankings, getFormats, getPokemonData, getMoveData } from './data.js';
import { QuizSession, generateExplanation } from './quiz.js';
import {
  showScreen, renderCups, showLastScore, renderQuizHeader,
  renderPokemonCard, showQuizLoading, renderResult,
  renderExplanation, renderSummary, setPokemonMap
} from './ui.js';

let gamemaster = null;
let pokemonMap = null;
let moveMap = null;
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
    moveMap = getMoveData(gamemaster);
    setPokemonMap(pokemonMap);

    // Render special cups from gamemaster
    const formats = getFormats(gamemaster);
    renderCups(formats);

    // Show last score if available
    const saved = localStorage.getItem('lastScore');
    if (saved) {
      const { score, total } = JSON.parse(saved);
      showLastScore(score, total);
    }
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
  showScreen('screen-quiz');
  showQuizLoading(true);

  try {
    const rankings = await getRankings(league, cup);
    currentSession = new QuizSession(rankings, leagueName);
    currentSession.league = league;
    currentSession.cup = cup;
    showNextRound();
  } catch (err) {
    console.error('Failed to load rankings:', err);
    showQuizLoading(false);
    alert('Failed to load league data. Check your connection and try again.');
    showScreen('screen-home');
  }
}

function showNextRound() {
  const pair = currentSession.nextRound();
  if (!pair) return;

  renderQuizHeader(currentSession.leagueName, currentSession.currentRound, currentSession.totalRounds);
  renderPokemonCard('a', pair.pokemonA);
  renderPokemonCard('b', pair.pokemonB);
  showQuizLoading(false);

  // Re-enable cards
  document.getElementById('pokemon-a').disabled = false;
  document.getElementById('pokemon-b').disabled = false;

  showScreen('screen-quiz');
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
    moveMap
  );

  renderResult(roundData);
  renderExplanation(explanation);

  // Update button text
  const nextBtn = document.getElementById('btn-next');
  if (currentSession.isComplete) {
    nextBtn.textContent = 'See Results';
  } else {
    nextBtn.textContent = 'Next Round';
  }

  showScreen('screen-result');
}

function showSummary() {
  renderSummary(currentSession);

  // Save last score
  const scoreData = { score: currentSession.score, total: currentSession.totalRounds };
  localStorage.setItem('lastScore', JSON.stringify(scoreData));
  showLastScore(scoreData.score, scoreData.total);

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
