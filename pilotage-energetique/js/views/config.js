import { currentCycle } from '../state.js';
import { f2, showMsg, irow } from '../ui.js';

export function renderConfig(state, onStateChange) {
  const c = currentCycle(state);
  if (!c) return;

  const fields = [
    ['c-start', c.start],
    ['c-end', c.end],
    ['c-ech', c.echeance],
    ['c-ech-elec', c.echElec || 0],
    ['c-ech-gaz', c.echGaz || 0],
    ['c-months', c.months],
  ];
  fields.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  prefillTarifFields(state);
  prefillNewCycleIndexes(state);
  renderTarifHistory(state);
  _bindConfigButtons(state, onStateChange);
}

function prefillTarifFields(state) {
  if (!state.tarifs || state.tarifs.length === 0) return;
  const last = state.tarifs.slice().sort((a, b) => b.dateEffet.localeCompare(a.dateEffet))[0];
  const map = [
    ['t-abo-elec', last.aboElec],
    ['t-bhc',      last.bhc],
    ['t-bhp',      last.bhp],
    ['t-whc',      last.whc],
    ['t-whp',      last.whp],
    ['t-rhc',      last.rhc],
    ['t-rhp',      last.rhp],
    ['t-abo-gaz',  last.aboGaz],
    ['t-gaz',      last.gazKwh],
    ['t-cta-elec', last.ctaElec],
    ['t-cta-gaz',  last.ctaGaz],
  ];
  map.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = val;
  });
}

function prefillNewCycleIndexes(state) {
  const c = currentCycle(state);
  if (!c) return;

  // Derniers index élec connus (idx_* du relevé le plus récent)
  const today = new Date().toISOString().slice(0, 10);
  const lastElecEntry = Object.entries(c.elec)
    .filter(([d]) => d <= today && c.elec[d].idx_hcb !== undefined)
    .sort((a, b) => b[0].localeCompare(a[0]))[0];

  if (lastElecEntry) {
    const e = lastElecEntry[1];
    const elecMap = [
      ['nc-hcb', e.idx_hcb],
      ['nc-hpb', e.idx_hpb],
      ['nc-hcw', e.idx_hcw],
      ['nc-hpw', e.idx_hpw],
      ['nc-hcr', e.idx_hcr],
      ['nc-hpr', e.idx_hpr],
    ];
    elecMap.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = val || 0;
    });
  }

  // Dernier index gaz connu
  const lastGasEntry = Object.entries(c.gas)
    .filter(([d]) => d <= today && c.gas[d].idx_m3 > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))[0];

  if (lastGasEntry) {
    const el = document.getElementById('nc-gaz');
    if (el && !el.value) el.value = lastGasEntry[1].idx_m3;
  }
}

function _bindConfigButtons(state, onStateChange) {
  const saveBtn = document.getElementById('c-save-btn');
  if (saveBtn && !saveBtn._bound) {
    saveBtn._bound = true;
    saveBtn.addEventListener('click', () => saveConfig(state, onStateChange));
  }

  const addTarifBtn = document.getElementById('c-add-tarif-btn');
  if (addTarifBtn && !addTarifBtn._bound) {
    addTarifBtn._bound = true;
    addTarifBtn.addEventListener('click', () => addTarif(state, onStateChange));
  }

  const newCycleBtn = document.getElementById('c-new-cycle-btn');
  if (newCycleBtn && !newCycleBtn._bound) {
    newCycleBtn._bound = true;
    newCycleBtn.addEventListener('click', () => startNewCycle(state, onStateChange));
  }

  const exportBtn = document.getElementById('c-export-btn');
  if (exportBtn && !exportBtn._bound) {
    exportBtn._bound = true;
    exportBtn.addEventListener('click', () => exportData(state));
  }

  const importInput = document.getElementById('c-import-file');
  if (importInput && !importInput._bound) {
    importInput._bound = true;
    importInput.addEventListener('change', (e) => importData(e, state, onStateChange));
  }
}

export function saveConfig(state, onStateChange) {
  const c = currentCycle(state);
  if (!c) return;
  c.start = document.getElementById('c-start')?.value || c.start;
  c.end = document.getElementById('c-end')?.value || c.end;
  c.echeance = parseFloat(document.getElementById('c-ech')?.value) || 231.99;
  c.echElec = parseFloat(document.getElementById('c-ech-elec')?.value) || 0;
  c.echGaz = parseFloat(document.getElementById('c-ech-gaz')?.value) || 0;
  c.months = parseInt(document.getElementById('c-months')?.value) || 11;
  onStateChange();
  showMsg('Configuration enregistrée.', 'config-msg');
}

export function addTarif(state, onStateChange) {
  const dateEffet = document.getElementById('t-date')?.value;
  if (!dateEffet) { alert('Date d\'effet requise.'); return; }
  const t = {
    dateEffet,
    label: 'Tarifs au ' + dateEffet,
    aboElec: parseFloat(document.getElementById('t-abo-elec')?.value) || 15.59,
    bhc: parseFloat(document.getElementById('t-bhc')?.value) || 0.1325,
    bhp: parseFloat(document.getElementById('t-bhp')?.value) || 0.1612,
    whc: parseFloat(document.getElementById('t-whc')?.value) || 0.1499,
    whp: parseFloat(document.getElementById('t-whp')?.value) || 0.1871,
    rhc: parseFloat(document.getElementById('t-rhc')?.value) || 0.1575,
    rhp: parseFloat(document.getElementById('t-rhp')?.value) || 0.7060,
    aboGaz: parseFloat(document.getElementById('t-abo-gaz')?.value) || 28.70,
    gazKwh: parseFloat(document.getElementById('t-gaz')?.value) || 0.1055,
    ctaElec: parseFloat(document.getElementById('t-cta-elec')?.value) || 27.0,
    ctaGaz: parseFloat(document.getElementById('t-cta-gaz')?.value) || 46.01,
  };
  state.tarifs.push(t);
  onStateChange();
  renderTarifHistory(state);
  showMsg('Nouveau tarif ajouté avec date d\'effet ' + dateEffet + '.', 'config-msg');
}

export function renderTarifHistory(state) {
  const el = document.getElementById('tarif-history');
  if (!el) return;
  const rows = state.tarifs.slice().sort((a, b) => b.dateEffet.localeCompare(a.dateEffet))
    .map(t => '<tr><td>' + t.dateEffet + '</td><td>' + t.label + '</td><td>' + t.bhc + '/' + t.bhp + '</td><td>' + t.whc + '/' + t.whp + '</td><td>' + t.rhc + '/' + t.rhp + '</td><td>' + t.gazKwh + '</td></tr>').join('');
  el.innerHTML = '<div class="tbl-wrap"><table><tr><th>Date effet</th><th>Label</th><th>Bleu HC/HP</th><th>Blanc HC/HP</th><th>Rouge HC/HP</th><th>Gaz kWh</th></tr>' + rows + '</table></div>';
}

export function startNewCycle(state, onStateChange) {
  const date = document.getElementById('nc-date')?.value;
  const ech = parseFloat(document.getElementById('nc-ech')?.value) || 0;
  if (!date || !ech) { alert('Date de facture et nouvelle mensualité requises.'); return; }
  if (!confirm('Clôturer le cycle actuel et démarrer un nouveau cycle au ' + date + ' ?\n\nLes données actuelles seront archivées.')) return;

  const btn = document.getElementById('c-new-cycle-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  const old = currentCycle(state);
  if (!old) return;
  const totalPaid = old.payments.filter(p => p.done).reduce((s, p) => s + p.amount, 0);
  state.archives.push({ ...old, totalPaid });

  const newId = Math.max(...state.cycles.map(c => c.id)) + 1;
  const newIndexElec = {
    hcb: parseFloat(document.getElementById('nc-hcb')?.value) || 0,
    hpb: parseFloat(document.getElementById('nc-hpb')?.value) || 0,
    hcw: parseFloat(document.getElementById('nc-hcw')?.value) || 0,
    hpw: parseFloat(document.getElementById('nc-hpw')?.value) || 0,
    hcr: parseFloat(document.getElementById('nc-hcr')?.value) || 0,
    hpr: parseFloat(document.getElementById('nc-hpr')?.value) || 0,
    gaz_m3: parseFloat(document.getElementById('nc-gaz')?.value) || 0,
  };
  const endDate = new Date(date);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);

  state.cycles.push({
    id: newId,
    label: 'Cycle ' + date.slice(0, 7) + ' → ' + endDate.toISOString().slice(0, 7),
    start: date, end: endDate.toISOString().slice(0, 10),
    echeance: ech, echElec: old.echElec, echGaz: old.echGaz,
    months: 11, indexStart: newIndexElec,
    elec: {}, gas: {}, payments: []
  });
  state.currentCycleId = newId;
  state.cycles = state.cycles.filter(c => c.id !== old.id || c.id === newId);

  onStateChange();
  ['nc-date', 'nc-ech', 'nc-hcb', 'nc-hpb', 'nc-hcw', 'nc-hpw', 'nc-hcr', 'nc-hpr', 'nc-gaz'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showMsg('Nouveau cycle enregistré — démarré au ' + date + '.', 'config-msg');
  setTimeout(() => { if (btn) { btn.disabled = false; btn.style.opacity = ''; } }, 1000);
}

function exportData(state) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'edf-tempo-backup-' + date + '.json'; a.click();
  URL.revokeObjectURL(url);
}

function importData(event, state, onStateChange) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object' || imported === null
        || !Array.isArray(imported.cycles) || !imported.currentCycleId) {
        alert('❌ Fichier invalide : ce n\'est pas une sauvegarde EDF Tempo.');
        return;
      }
      if (!confirm('⚠️ Cette opération va remplacer toutes vos données actuelles.\nContinuer ?')) return;
      Object.assign(state, imported);
      onStateChange();
      showMsg('Données restaurées avec succès.', 'config-msg');
    } catch (err) {
      alert('❌ Impossible de lire ce fichier.');
    }
  };
  reader.readAsText(file);
}
