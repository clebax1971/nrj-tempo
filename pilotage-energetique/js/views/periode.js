import { currentCycle } from '../state.js';
import { getTarif, elecCostForEntry, daysBetween } from '../engine.js';
import { f2, f1, fday, irow } from '../ui.js';
import { tempoColor } from '../tempo-cal.js';

export function renderPeriode(state) {
  const btn = document.getElementById('p-analyze-btn');
  if (!btn) return;

  // Attacher l'événement seulement une fois
  if (!btn._bound) {
    btn._bound = true;
    btn.addEventListener('click', () => analyzePeriod(state));
  }
}

function analyzePeriod(state) {
  const from = document.getElementById('p-from').value;
  const to = document.getElementById('p-to').value;
  if (!from || !to) { alert('Sélectionnez une période.'); return; }
  const cycle = currentCycle(state);
  if (!cycle) return;
  const tarif0 = getTarif(state, to);

  let elecCost = 0, elecKwh = 0, gasCost = 0, gasKwh = 0;
  const byColor = { blue: { kwh: 0, cost: 0 }, white: { kwh: 0, cost: 0 }, red: { kwh: 0, cost: 0 } };

  for (const [d, e] of Object.entries(cycle.elec)) {
    if (d < from || d > to) continue;
    const tarif = getTarif(state, d);
    const cost = elecCostForEntry(e, tarif);
    const kwh = (e.hcb || 0) + (e.hpb || 0) + (e.hcw || 0) + (e.hpw || 0) + (e.hcr || 0) + (e.hpr || 0);
    elecCost += cost; elecKwh += kwh;
    const color = e.color || tempoColor(d);
    byColor[color].kwh += kwh; byColor[color].cost += cost;
  }
  for (const [d, g] of Object.entries(cycle.gas)) {
    if (d < from || d > to) continue;
    const tarif = getTarif(state, d);
    gasCost += g.kwh * tarif.gazKwh; gasKwh += g.kwh;
  }
  const days = Math.max(1, daysBetween(from, to) + 1);
  const fixedPerDay = (tarif0.aboElec + tarif0.aboGaz) * 12 / 365 + (tarif0.ctaElec + tarif0.ctaGaz) / 365;
  const fixed = fixedPerDay * days;
  const total = elecCost + gasCost + fixed;

  document.getElementById('p-result').innerHTML =
    '<div class="card" style="margin-bottom:0">' +
    irow('Durée analysée', days + ' jours') +
    irow('Électricité', f2(elecCost) + ' · ' + f1(elecKwh)) +
    '<div style="padding:2px 0 2px 1rem">' +
    Object.entries(byColor).map(([c, v]) => v.kwh > 0 ?
      '<div style="font-size:12px;color:var(--text2);display:flex;justify-content:space-between"><span><span class="badge b-' + c + '" style="font-size:10px">' + c + '</span></span><span>' + f1(v.kwh) + ' / ' + f2(v.cost) + '</span></div>' : ''
    ).join('') + '</div>' +
    irow('Gaz', f2(gasCost) + ' · ' + f1(gasKwh)) +
    irow('Abonnements + CTA proratisés', f2(fixed)) +
    '<div class="sep"></div>' +
    irow('<strong>Total période</strong>', '<strong class="c-blue">' + f2(total) + '</strong>') +
    irow('Moyenne par jour', fday(total / days)) +
    '</div>';
}
