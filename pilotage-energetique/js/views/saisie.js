import { currentCycle } from '../state.js';
import { getTarif, elecCostForEntry } from '../engine.js';
import { tempoColor } from '../tempo-cal.js';
import { showMsg, f1, f2 } from '../ui.js';

// ─── Helpers index précédents ───────────────────────────────────────────────

function getPrevRawIndex(cycle, date) {
  const prev = Object.entries(cycle.elec)
    .filter(([d]) => d < date && cycle.elec[d].idx_hcb !== undefined)
    .sort((a, b) => b[0].localeCompare(a[0]))[0];
  if (!prev) return {
    hcb: cycle.indexStart.hcb || 0, hpb: cycle.indexStart.hpb || 0,
    hcw: cycle.indexStart.hcw || 0, hpw: cycle.indexStart.hpw || 0,
    hcr: cycle.indexStart.hcr || 0, hpr: cycle.indexStart.hpr || 0
  };
  return {
    hcb: prev[1].idx_hcb, hpb: prev[1].idx_hpb,
    hcw: prev[1].idx_hcw, hpw: prev[1].idx_hpw,
    hcr: prev[1].idx_hcr, hpr: prev[1].idx_hpr
  };
}

function getPrevRawM3(cycle, date) {
  const prev = Object.entries(cycle.gas)
    .filter(([d]) => d < date && cycle.gas[d].idx_m3 > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))[0];
  if (!prev) return { val: cycle.indexStart.gaz_m3 || 0, date: null };
  return { val: prev[1].idx_m3, date: prev[0] };
}

function getPrevRawWater(cycle, date) {
  const water = cycle.water || {};
  const prev = Object.entries(water)
    .filter(([d]) => d < date && water[d].idx_m3 > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))[0];
  if (!prev) return { val: cycle.indexStart.water_m3 || 0, date: null };
  return { val: prev[1].idx_m3, date: prev[0] };
}

// ─── Pré-remplissage ─────────────────────────────────────────────────────────

function prefillAll(state) {
  const date = document.getElementById('s-date')?.value;
  if (!date) return;
  const cycle = currentCycle(state);
  if (!cycle) return;

  // Élec — pré-remplir avec derniers index connus
  const prev = getPrevRawIndex(cycle, date);
  const fields = ['hcb', 'hpb', 'hcw', 'hpw', 'hcr', 'hpr'];
  fields.forEach(f => {
    const el = document.getElementById('s-' + f);
    if (!el) return;
    el.value = prev[f] > 0 ? prev[f] : '';
  });

  // Gaz
  const prevGas = getPrevRawM3(cycle, date);
  const gvalEl = document.getElementById('s-gval');
  if (gvalEl) gvalEl.value = prevGas.val > 0 ? prevGas.val : '';
  const prevGasDiv = document.getElementById('s-prev-gas');
  if (prevGasDiv) {
    if (prevGas.date) {
      prevGasDiv.style.display = 'block';
      prevGasDiv.textContent = 'Dernier index gaz (' + prevGas.date + ') : ' + prevGas.val + ' m³';
    } else {
      prevGasDiv.style.display = 'none';
    }
  }

  // Eau
  const prevWater = getPrevRawWater(cycle, date);
  const wvalEl = document.getElementById('s-wval');
  if (wvalEl) wvalEl.value = prevWater.val > 0 ? prevWater.val : '';
  const prevWaterDiv = document.getElementById('s-prev-water');
  if (prevWaterDiv) {
    if (prevWater.date) {
      prevWaterDiv.style.display = 'block';
      prevWaterDiv.textContent = 'Dernier index eau (' + prevWater.date + ') : ' + prevWater.val + ' m³';
    } else {
      prevWaterDiv.style.display = 'none';
    }
  }

  // Info relevé existant
  const prevInfo = document.getElementById('s-prev-info');
  if (prevInfo) {
    const hasElec = !!cycle.elec[date];
    const hasGas  = !!cycle.gas[date];
    const hasWater = !!(cycle.water || {})[date];
    if (hasElec || hasGas || hasWater) {
      prevInfo.style.display = 'block';
      prevInfo.innerHTML = '⚠️ Un relevé existe déjà pour ce jour — la sauvegarde <strong>écrasera</strong> les données existantes.';
    } else {
      prevInfo.style.display = 'none';
    }
  }
}

// ─── Sauvegarde unifiée ──────────────────────────────────────────────────────

function saveEntry(state, onStateChange) {
  const date = document.getElementById('s-date')?.value;
  if (!date) { alert('Date requise.'); return; }

  const cycle = currentCycle(state);
  if (!cycle) return;
  if (!cycle.water) cycle.water = {};

  let savedParts = [];

  // --- Élec ---
  const fields = ['hcb', 'hpb', 'hcw', 'hpw', 'hcr', 'hpr'];
  const vals = fields.map(f => {
    const v = parseFloat(document.getElementById('s-' + f)?.value);
    return isNaN(v) ? null : v;
  });
  if (vals.some(v => v !== null)) {
    const prevIdx = getPrevRawIndex(cycle, date);
    const entry = {};
    fields.forEach((f, i) => {
      const newVal = vals[i] !== null ? vals[i] : (prevIdx[f] || 0);
      entry[f] = Math.max(0, newVal - (prevIdx[f] || 0));
      entry['idx_' + f] = newVal;
    });
    entry.color = tempoColor(date);
    cycle.elec[date] = entry;
    savedParts.push('élec');
  }

  // --- Gaz ---
  const gval = parseFloat(document.getElementById('s-gval')?.value);
  if (!isNaN(gval) && gval > 0) {
    const coeff = parseFloat(document.getElementById('s-gcoeff')?.value) || 11.30;
    const prevGas = getPrevRawM3(cycle, date);
    const m3delta = Math.max(0, Math.round((gval - prevGas.val) * 10) / 10);
    cycle.gas[date] = {
      kwh: Math.max(0, Math.round(m3delta * coeff * 100) / 100),
      m3: m3delta,
      coeff,
      idx_m3: gval
    };
    savedParts.push('gaz');
  }

  // --- Eau ---
  const wval = parseFloat(document.getElementById('s-wval')?.value);
  if (!isNaN(wval) && wval > 0) {
    const prevWater = getPrevRawWater(cycle, date);
    const m3delta = Math.max(0, Math.round((wval - prevWater.val) * 1000) / 1000);
    cycle.water[date] = { m3: m3delta, idx_m3: wval };
    savedParts.push('eau');
  }

  if (savedParts.length === 0) { alert('Saisissez au moins un index.'); return; }

  onStateChange();
  prefillAll(state);
  renderHistorique(state);
  showMsg('Relevé enregistré (' + savedParts.join(', ') + ').', 'import-msg');
}

// ─── Historique ──────────────────────────────────────────────────────────────

export function renderHistorique(state) {
  const cycle = currentCycle(state);
  if (!cycle) return;
  const today = new Date().toISOString().slice(0, 10);
  const elecDates = Object.keys(cycle.elec).filter(d => d >= cycle.start && d <= today).sort().reverse().slice(0, 30);
  const rows = elecDates.map(d => {
    const e = cycle.elec[d];
    const g = cycle.gas[d];
    const w = (cycle.water || {})[d];
    const tarif = getTarif(state, d);
    const ecost = elecCostForEntry(e || { hcb:0,hpb:0,hcw:0,hpw:0,hcr:0,hpr:0 }, tarif);
    const gcost = g ? g.kwh * tarif.gazKwh : 0;
    const color = e ? (e.color || tempoColor(d)) : 'blue';
    const kwh = e ? (e.hcb + e.hpb + e.hcw + e.hpw + e.hcr + e.hpr) : 0;
    return '<tr>' +
      '<td>' + d + '</td>' +
      '<td><span class="badge b-' + color + '">' + { blue:'B', white:'W', red:'R' }[color] + '</span></td>' +
      '<td>' + kwh.toFixed(1) + '</td>' +
      '<td>' + ecost.toFixed(2) + '</td>' +
      '<td>' + (g ? g.kwh.toFixed(1) : '-') + '</td>' +
      '<td>' + gcost.toFixed(2) + '</td>' +
      '<td>' + (w ? w.idx_m3.toFixed(2) + ' m³' : '-') + '</td>' +
      '</tr>';
  }).join('');
  const histEl = document.getElementById('hist-table');
  if (histEl) {
    histEl.innerHTML =
      '<div class="tbl-wrap"><table>' +
      '<tr><th>Date</th><th>Tempo</th><th>Élec kWh</th><th>Élec €</th><th>Gaz kWh</th><th>Gaz €</th><th>Eau</th></tr>' +
      rows + '</table></div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:.5rem">30 derniers relevés</div>';
  }
}

// ─── Purge ───────────────────────────────────────────────────────────────────

function purgeReleves(state, onStateChange) {
  const cycle = currentCycle(state);
  if (!cycle) return;
  const nbElec = Object.keys(cycle.elec).length;
  const nbGas = Object.keys(cycle.gas).length;
  const nbWater = Object.keys(cycle.water || {}).length;
  if (!confirm('⚠️ Purger tous les relevés du cycle actuel ?\n\n' + nbElec + ' relevés élec · ' + nbGas + ' relevés gaz · ' + nbWater + ' relevés eau\n\nCette action est irréversible.')) return;
  if (!confirm('Confirmation finale : supprimer ' + (nbElec + nbGas + nbWater) + ' relevés ?')) return;
  cycle.elec = {};
  cycle.gas = {};
  cycle.water = {};
  onStateChange();
  renderHistorique(state);
  showMsg('Relevés purgés.', 'import-msg');
}

// ─── CSV local ───────────────────────────────────────────────────────────────

function previewCSVLocal(event, type, state, onStateChange) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    import('../csv.js').then(({ parseCSV, renderCSVPreview: rcsvp }) => {
      const { rows, errors, totalAnalyzed } = parseCSV(e.target.result, type);
      state.csvPreviewData = { type, rows, errors, totalAnalyzed, fileName: file.name };
      rcsvp(state, onStateChange);
    });
  };
  reader.readAsText(file, 'ISO-8859-1');
}

// ─── Render principal ────────────────────────────────────────────────────────

export function renderSaisie(state, onStateChange) {
  const today = new Date().toISOString().slice(0, 10);
  const dateEl = document.getElementById('s-date');
  if (dateEl && !dateEl.value) dateEl.value = today;

  prefillAll(state);
  renderHistorique(state);

  if (dateEl && !dateEl._bound) {
    dateEl._bound = true;
    dateEl.addEventListener('change', () => prefillAll(state));
  }

  const saveBtn = document.getElementById('s-save-btn');
  if (saveBtn && !saveBtn._bound) {
    saveBtn._bound = true;
    saveBtn.addEventListener('click', () => saveEntry(state, onStateChange));
  }

  const purgeBtn = document.getElementById('s-purge-btn');
  if (purgeBtn && !purgeBtn._bound) {
    purgeBtn._bound = true;
    purgeBtn.addEventListener('click', () => purgeReleves(state, onStateChange));
  }

  const elecFileInput = document.getElementById('s-csv-elec');
  if (elecFileInput && !elecFileInput._bound) {
    elecFileInput._bound = true;
    elecFileInput.addEventListener('change', (e) => previewCSVLocal(e, 'elec', state, onStateChange));
  }

  const gasFileInput = document.getElementById('s-csv-gas');
  if (gasFileInput && !gasFileInput._bound) {
    gasFileInput._bound = true;
    gasFileInput.addEventListener('change', (e) => previewCSVLocal(e, 'gas', state, onStateChange));
  }
}

// Compat export pour app.js qui peut encore appeler prefillElecIndexes/prefillGasIndex
export function prefillElecIndexes(state) { prefillAll(state); }
export function prefillGasIndex(state) { prefillAll(state); }
