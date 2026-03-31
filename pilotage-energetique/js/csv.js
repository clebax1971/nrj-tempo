import { tempoColor } from './tempo-cal.js';

export function detectSeparator(text) {
  const lines = text.split('\n').slice(0, 5);
  const counts = { ';': 0, ',': 0, '\t': 0 };
  for (const line of lines) for (const ch of line) if (counts[ch] !== undefined) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function normalizeDate(raw) {
  const s = raw.trim().split(' ')[0];
  const m1 = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m1) return m1[3] + '-' + m1[2] + '-' + m1[1];
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;
  return null;
}

export function normalizeNumber(raw) {
  if (!raw && raw !== 0) return null;
  const n = parseFloat(String(raw).replace(/"/g, '').replace(/\s/g, '').replace(/,/g, '.'));
  return isNaN(n) ? null : n;
}

export function detectColumns(headers) {
  const map = {};
  const rules = [
    { role: 'date',  matches: ['date', 'jour', 'horodate', 'timestamp', 'période'] },
    { role: 'hcb',   matches: ['heures creuses bleu', 'hcb', 'hc bleu', 'creuses bleu'] },
    { role: 'hpb',   matches: ['heures pleines bleu', 'hpb', 'hp bleu', 'pleines bleu'] },
    { role: 'hcw',   matches: ['heures creuses blanc', 'hcw', 'hc blanc', 'creuses blanc'] },
    { role: 'hpw',   matches: ['heures pleines blanc', 'hpw', 'hp blanc', 'pleines blanc'] },
    { role: 'hcr',   matches: ['heures creuses rouge', 'hcr', 'hc rouge', 'creuses rouge'] },
    { role: 'hpr',   matches: ['heures pleines rouge', 'hpr', 'hp rouge', 'pleines rouge'] },
    { role: 'm3',    matches: ['m3', 'm³', 'volume', 'consommation', 'valeur'] },
    { role: 'coeff', matches: ['coeff', 'coefficient', 'facteur'] },
  ];
  headers.forEach((h, i) => {
    const hn = h.toLowerCase().trim();
    for (const rule of rules) {
      if (rule.matches.some(m => hn.includes(m))) { if (map[rule.role] === undefined) map[rule.role] = i; break; }
    }
  });
  return map;
}

export function parseCSV(text, type) {
  const sep = detectSeparator(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows = [], errors = [];
  let totalAnalyzed = 0;

  let headerIdx = -1;
  // Priorité : ligne contenant 'date' ou 'horodate' avec au moins 3 colonnes
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if ((lower.includes('date') || lower.includes('horodate')) && lines[i].split(sep).length >= 3) {
      headerIdx = i; break;
    }
  }
  // Fallback : ligne contenant 'index' avec au moins 3 colonnes
  if (headerIdx < 0) {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes('index') && lines[i].split(sep).length >= 3) {
        headerIdx = i; break;
      }
    }
  }

  let colMap = null, dataStart = 0;
  if (headerIdx >= 0) { colMap = detectColumns(lines[headerIdx].split(sep)); dataStart = headerIdx + 1; }

  for (let i = dataStart; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    totalAnalyzed++;
    try {
      let dateIso, rowData;
      if (colMap) {
        const rawDate = colMap.date !== undefined ? parts[colMap.date] : null;
        if (!rawDate) { errors.push('Ligne ' + (i + 1) + ' : date manquante'); continue; }
        dateIso = normalizeDate(rawDate);
        if (!dateIso) { errors.push('Ligne ' + (i + 1) + ' : date invalide (' + rawDate + ')'); continue; }
        if (type === 'elec') {
          const vals = ['hcb', 'hpb', 'hcw', 'hpw', 'hcr', 'hpr'].map(r => colMap[r] !== undefined ? normalizeNumber(parts[colMap[r]]) || 0 : 0);
          if (vals.every(v => v === 0)) continue;
          rowData = { dateIso, vals, raw: parts.slice(0, 8).join(sep) };
        } else {
          const m3 = colMap.m3 !== undefined ? normalizeNumber(parts[colMap.m3]) : null;
          const coeff = colMap.coeff !== undefined ? normalizeNumber(parts[colMap.coeff]) : 11.30;
          if (m3 === null || m3 === 0) { errors.push('Ligne ' + (i + 1) + ' : index m³ invalide'); continue; }
          rowData = { dateIso, m3, coeff: coeff || 11.30, raw: parts.slice(0, 4).join(sep) };
        }
      } else {
        if (type === 'elec') {
          if (parts.length < 8) continue;
          dateIso = normalizeDate(parts[0]);
          if (!dateIso) { errors.push('Ligne ' + (i + 1) + ' : date invalide'); continue; }
          const vals = parts.slice(2, 8).map(v => normalizeNumber(v) || 0);
          if (vals.every(v => v === 0)) continue;
          rowData = { dateIso, vals, raw: parts.slice(0, 8).join(sep) };
        } else {
          if (parts.length < 4) continue;
          dateIso = normalizeDate(parts[0]);
          if (!dateIso) { errors.push('Ligne ' + (i + 1) + ' : date invalide'); continue; }
          const m3 = normalizeNumber(parts[2]);
          const coeff = normalizeNumber(parts[3]) || 11.30;
          if (m3 === null || m3 === 0) { errors.push('Ligne ' + (i + 1) + ' : index m³ invalide'); continue; }
          rowData = { dateIso, m3, coeff, raw: parts.slice(0, 4).join(sep) };
        }
      }
      rows.push(rowData);
    } catch (err) { errors.push('Ligne ' + (i + 1) + ' : erreur inattendue'); }
  }
  return { rows, errors, totalAnalyzed };
}

export function previewCSV(event, type, state, onStateChange) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const { rows, errors, totalAnalyzed } = parseCSV(e.target.result, type);
    state.csvPreviewData = { type, rows, errors, totalAnalyzed, fileName: file.name };
    renderCSVPreview(state, onStateChange);
  };
  reader.readAsText(file, 'ISO-8859-1');
}

export function renderCSVPreview(state, onStateChange) {
  const p = state.csvPreviewData;
  if (!p) return;
  const el = document.getElementById('csv-preview');
  if (!el) return;
  const total = p.rows.length, errCount = p.errors.length;
  const ready = total > 0;
  const statusColor = errCount === 0 && ready ? 'var(--green)' : errCount > 0 ? 'var(--amber)' : 'var(--red)';
  const statusText = !ready ? '❌ Aucune donnée valide' : errCount > 0 ? '⚠️ ' + errCount + ' ligne(s) ignorée(s)' : '✓ Prêt à importer';
  const previewRows = p.rows.slice(0, 10).map(r =>
    '<tr><td style="padding:3px 6px;font-size:11px;color:var(--text2)">' + r.dateIso + '</td>' +
    '<td style="padding:3px 6px;font-size:11px;color:var(--text3);overflow:hidden;max-width:200px">' + r.raw + '</td></tr>'
  ).join('');
  el.innerHTML =
    '<div style="font-size:13px;margin-bottom:.4rem"><span style="color:var(--text2)">Fichier : </span><b>' + p.fileName + '</b></div>' +
    '<div style="display:flex;gap:1rem;font-size:12px;margin-bottom:.4rem;flex-wrap:wrap">' +
    '<span style="color:var(--text2)">Analysées : <b style="color:var(--text)">' + p.totalAnalyzed + '</b></span>' +
    '<span style="color:var(--text2)">Valides : <b style="color:var(--text)">' + total + '</b></span>' +
    '<span style="color:var(--text2)">Erreurs : <b style="color:' + (errCount > 0 ? 'var(--amber)' : 'var(--text)') + '">' + errCount + '</b></span>' +
    '<span style="color:' + statusColor + '"><b>' + statusText + '</b></span>' +
    '</div>' +
    (errCount > 0 ? '<div style="font-size:11px;color:var(--amber);margin-bottom:.4rem">' + p.errors.slice(0, 3).join(' · ') + (p.errors.length > 3 ? ' …' : '') + '</div>' : '') +
    '<div style="overflow-x:auto;margin-bottom:.6rem"><table style="width:100%">' + previewRows + '</table></div>' +
    (ready ? '<button class="btn btn-primary" id="csv-confirm-btn">Valider et importer (' + total + ' lignes)</button>' : '');

  if (ready) {
    const confirmBtn = document.getElementById('csv-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => confirmImport(state, onStateChange));
    }
  }
}

export function integrateCSVData(state) {
  const p = state.csvPreviewData;
  if (!p || p.rows.length === 0) return { imported: 0, skippedOutOfRange: 0, skippedDuplicate: 0 };
  const cycle = state.cycles.find(c => c.id === state.currentCycleId);
  if (!cycle) return { imported: 0, skippedOutOfRange: 0, skippedDuplicate: 0 };
  let imported = 0, skippedOutOfRange = 0, skippedDuplicate = 0;
  const sortedRows = [...p.rows].sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  function getPrevRawIndex(date) {
    const prev = Object.entries(cycle.elec)
      .filter(([d]) => d < date && cycle.elec[d].idx_hcb !== undefined)
      .sort((a, b) => b[0].localeCompare(a[0]))[0];
    if (!prev) return { hcb: cycle.indexStart.hcb || 0, hpb: cycle.indexStart.hpb || 0, hcw: cycle.indexStart.hcw || 0, hpw: cycle.indexStart.hpw || 0, hcr: cycle.indexStart.hcr || 0, hpr: cycle.indexStart.hpr || 0 };
    return { hcb: prev[1].idx_hcb, hpb: prev[1].idx_hpb, hcw: prev[1].idx_hcw, hpw: prev[1].idx_hpw, hcr: prev[1].idx_hcr, hpr: prev[1].idx_hpr };
  }

  function getPrevRawM3(date) {
    const prev = Object.entries(cycle.gas)
      .filter(([d]) => d < date && cycle.gas[d].idx_m3 > 0)
      .sort((a, b) => b[0].localeCompare(a[0]))[0];
    if (!prev) return cycle.indexStart.gaz_m3 || 0;
    return prev[1].idx_m3;
  }

  if (p.type === 'elec') {
    for (const row of sortedRows) {
      if (row.dateIso < cycle.start || row.dateIso > cycle.end) { skippedOutOfRange++; continue; }
      if (cycle.elec[row.dateIso]) { skippedDuplicate++; continue; }
      const prevIdx = getPrevRawIndex(row.dateIso) || { hcb: 0, hpb: 0, hcw: 0, hpw: 0, hcr: 0, hpr: 0 };
      const v = row.vals;
      cycle.elec[row.dateIso] = {
        hcb: Math.max(0, v[0] - prevIdx.hcb), hpb: Math.max(0, v[1] - prevIdx.hpb),
        hcw: Math.max(0, v[2] - prevIdx.hcw), hpw: Math.max(0, v[3] - prevIdx.hpw),
        hcr: Math.max(0, v[4] - prevIdx.hcr), hpr: Math.max(0, v[5] - prevIdx.hpr),
        color: tempoColor(row.dateIso),
        idx_hcb: v[0], idx_hpb: v[1], idx_hcw: v[2], idx_hpw: v[3], idx_hcr: v[4], idx_hpr: v[5]
      };
      imported++;
    }
  } else {
    for (const row of sortedRows) {
      if (row.dateIso < cycle.start || row.dateIso > cycle.end) { skippedOutOfRange++; continue; }
      if (cycle.gas[row.dateIso]) { skippedDuplicate++; continue; }
      const prevM3 = getPrevRawM3(row.dateIso) || 0;
      cycle.gas[row.dateIso] = {
        kwh: Math.max(0, (row.m3 - prevM3) * row.coeff),
        m3: row.m3 - prevM3, coeff: row.coeff, idx_m3: row.m3
      };
      imported++;
    }
  }
  return { imported, skippedOutOfRange, skippedDuplicate };
}

export function confirmImport(state, onStateChange) {
  const p = state.csvPreviewData;
  if (!p || p.rows.length === 0) { alert('Aucune donnée à importer.'); return; }
  const { imported, skippedOutOfRange, skippedDuplicate } = integrateCSVData(state);
  delete state.csvPreviewData;
  onStateChange();
  const previewEl = document.getElementById('csv-preview');
  if (previewEl) previewEl.innerHTML = '';
  const msgEl = document.getElementById('import-msg');
  if (msgEl) {
    msgEl.textContent = imported + ' lignes importées — ' + skippedDuplicate + ' doublons, ' + skippedOutOfRange + ' hors cycle.';
    setTimeout(() => { msgEl.textContent = ''; }, 3500);
  }
}
