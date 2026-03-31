import { loadState, defaultState, saveState, currentCycle, autoMarkPayments, migrateWater } from './state.js';
import { tempoColor } from './tempo-cal.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSaisie } from './views/saisie.js';
import { renderPeriode } from './views/periode.js';
import { renderEcheancier } from './views/echeancier.js';
import { renderArchives } from './views/archives.js';
import { renderConfig } from './views/config.js';

let STATE = loadState() || defaultState();
migrateWater(STATE);
autoMarkPayments(STATE);
saveState(STATE);
let activeTab = 'dashboard';

function onStateChange() {
  autoMarkPayments(STATE);
  saveState(STATE);
  renderActive();
  renderTopbar();
}

function renderTopbar() {
  const cycle = currentCycle(STATE);
  const cycleEl = document.getElementById('tb-cycle');
  if (cycleEl && cycle) {
    cycleEl.textContent = cycle.label + ' · ' + cycle.start + ' → ' + cycle.end;
  }
}

function showTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.top-tabs .tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });

  activeTab = name;
  window.scrollTo({ top: 0, behavior: 'instant' });
  renderActive();
}

function renderActive() {
  switch (activeTab) {
    case 'dashboard':   renderDashboard(STATE); break;
    case 'saisie':      renderSaisie(STATE, onStateChange); break;
    case 'periode':     renderPeriode(STATE); break;
    case 'echeancier':  renderEcheancier(STATE); break;
    case 'archives':    renderArchives(STATE); break;
    case 'config':      renderConfig(STATE, onStateChange); break;
  }
}

// Navigation
document.querySelectorAll('.nav-item, .top-tabs .tab').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Init
renderTopbar();
renderDashboard(STATE);
