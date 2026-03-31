import { currentCycle } from '../state.js';
import { computeCycleStats, computeExtrap } from '../engine.js';
import { f2, fday, irow } from '../ui.js';

export function renderEcheancier(state) {
  const cycle = currentCycle(state);
  if (!cycle) return;
  const today = new Date().toISOString().slice(0, 10);
  const stats = computeCycleStats(cycle, today, state);
  const extrap = computeExtrap(cycle, state);
  const echeanceTotal = cycle.echeance * cycle.months;
  const isPaid = p => p.done || p.date <= today;
  const paid = cycle.payments.filter(isPaid).reduce((s, p) => s + p.amount, 0);
  const toCome = cycle.payments.filter(p => !isPaid(p)).reduce((s, p) => s + p.amount, 0);

  document.getElementById('ech-bloc').innerHTML =
    irow('Total prélevé à ce jour', '<span class="c-ok">' + f2(paid) + '</span>') +
    irow('Reste à prélever', f2(toCome)) +
    irow('Total échéancier (' + cycle.months + ' × ' + f2(cycle.echeance) + ')', f2(echeanceTotal)) +
    '<div class="sep"></div>' +
    irow('Consommé réel à ce jour', f2(stats.total)) +
    irow('Écart prélevé / consommé', '<span class="' + (paid >= stats.total ? 'c-ok' : 'c-warn') + '">' + (paid - stats.total >= 0 ? '+' : '') + f2(paid - stats.total) + '</span>');

  if (!extrap) {
    document.getElementById('ech-pilotage').innerHTML =
      '<div style="color:var(--text3);font-size:12px">Aucun cycle de référence défini — projection indisponible.</div>';
    return;
  }

  const diff = extrap.totalProjected - echeanceTotal;
  const ec = diff <= 0 ? 'c-ok' : diff <= 150 ? 'c-warn' : 'c-danger';
  const pctProj = Math.min(Math.round(extrap.totalProjected / echeanceTotal * 100), 100);

  document.getElementById('ech-pilotage').innerHTML =
    irow('Total projeté fin de cycle', '<span class="' + ec + '">' + f2(extrap.totalProjected) + '</span>') +
    irow('Objectif échéancier', f2(echeanceTotal)) +
    irow('Écart projeté', '<span class="' + ec + '">' + (diff >= 0 ? '+' : '') + f2(diff) + '</span>') +
    irow('Rythme élec vs C1', Math.round(extrap.paceElec * 100) + '%') +
    irow('Rythme gaz vs C1', Math.round(extrap.paceGas * 100) + '%') +
    irow('Fiabilité modèle', '±' + extrap.reliability + '% · ' + extrap.completePositions + '/12 périodes') +
    '<div class="prog-wrap"><div class="prog-bg"><div class="prog-fill" style="width:' + pctProj + '%;background:' + (diff <= 0 ? 'var(--green)' : diff <= 150 ? 'var(--amber)' : 'var(--red)') + '"></div></div></div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:.35rem">Budget max/jour pour tenir l\'échéancier : ' + fday(echeanceTotal / stats.totalDays) + '</div>';

  document.getElementById('ech-detail').innerHTML =
    '<div class="tbl-wrap"><table><tr><th>Date</th><th>Montant</th><th>Élec</th><th>Gaz</th><th>Statut</th></tr>' +
    cycle.payments.map(p =>
      '<tr><td>' + p.date + '</td><td>' + f2(p.amount) + '</td><td>' + f2(cycle.echElec || 0) + '</td><td>' + f2(cycle.echGaz || 0) + '</td><td>' +
      (isPaid(p) ? '<span class="badge b-ok">Prélevé</span>' : '<span class="badge b-warn">À venir</span>') + '</td></tr>'
    ).join('') +
    '</table></div>';
}
