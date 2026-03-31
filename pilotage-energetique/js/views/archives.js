import { computeCycleStats } from '../engine.js';
import { f2, f1, irow } from '../ui.js';

export function renderArchives(state) {
  const list = state.archives;
  const listEl = document.getElementById('arch-list');
  if (!listEl) return;
  if (list.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text3);font-size:12px">Aucun cycle archivé pour l\'instant.</div>';
    return;
  }
  listEl.innerHTML = list.map((a, i) =>
    '<div class="irow" style="cursor:pointer" data-arch-idx="' + i + '"><span class="label">' + a.label + ' (' + a.start + ' → ' + a.end + ')</span><span class="val c-blue">Consulter →</span></div>'
  ).join('');

  listEl.querySelectorAll('[data-arch-idx]').forEach(el => {
    el.addEventListener('click', () => showArchive(parseInt(el.dataset.archIdx), state));
  });
}

export function showArchive(i, state) {
  const a = state.archives[i];
  const card = document.getElementById('arch-detail-card');
  const title = document.getElementById('arch-detail-title');
  const detail = document.getElementById('arch-detail');
  if (!card || !title || !detail) return;

  card.style.display = 'block';
  title.textContent = a.label;

  // Correction bug : pas de hack STATE, appel direct
  const stats = computeCycleStats(a, a.end, state);

  detail.innerHTML =
    irow('Période', a.start + ' → ' + a.end) +
    irow('Consommation totale', f2(stats.total)) +
    irow('Électricité', f2(stats.elecCost) + ' · ' + f1(stats.elecKwh)) +
    irow('Gaz', f2(stats.gasCost) + ' · ' + f1(stats.gasKwh)) +
    irow('Charges fixes', f2(stats.fixedTotal)) +
    irow('Prélevé échéancier', f2(a.totalPaid || 0)) +
    irow('Régularisation', '<span class="' + ((a.totalPaid || 0) >= stats.total ? 'c-ok' : 'c-danger') + '">' + (((a.totalPaid || 0) - stats.total) >= 0 ? '+' : '') + f2((a.totalPaid || 0) - stats.total) + '</span>');
}
