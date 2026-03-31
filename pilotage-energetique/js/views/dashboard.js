import { currentCycle } from '../state.js';
import { computeCycleStats, computeExtrap, computeTempoBreakdown, generateAlerts, generateRecommendations, getTarif, daysBetween } from '../engine.js';
import { f2, f1, fday, irow, kpiCard, tempoBar } from '../ui.js';
import { tempoColor } from '../tempo-cal.js';

export function renderDashboard(state) {
  const cycle = currentCycle(state);
  if (!cycle) return;
  const today = new Date().toISOString().slice(0, 10);
  const stats = computeCycleStats(cycle, today, state);
  const extrap = computeExtrap(cycle, state);
  const echeanceTotal = cycle.echeance * cycle.months;
  const isPaid = p => p.done || p.date <= today;
  const paid = cycle.payments.filter(isPaid).reduce((s, p) => s + p.amount, 0);

  // Alertes — sans le dépassement vs prélèvements (redondant avec le bloc fusionné)
  const by = computeTempoBreakdown(cycle, state);
  const alerts = generateAlerts(stats, extrap, paid, echeanceTotal, by, state, cycle)
    .filter(a => !a.message.toLowerCase().includes('prélèvement'));
  document.getElementById('db-alert').innerHTML = alerts
    .map(a => '<div class="alert alert-' + a.type + '">' + a.message + '</div>').join('');

  // Bonjour
  const recoEl = document.getElementById('db-reco');
  if (recoEl) {
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const now = new Date();
    recoEl.innerHTML =
      '<div style="padding:14px 16px;border-radius:var(--r);margin-bottom:1rem;background:var(--bg3);border-left:3px solid var(--blue)">' +
      '<div style="font-size:18px;font-weight:700;color:var(--text)">Bonjour</div>' +
      '<div style="font-size:13px;color:var(--text2);margin-top:4px">' +
      jours[now.getDay()] + ' ' + now.getDate() + ' ' + mois[now.getMonth()] + ' ' + now.getFullYear() +
      '</div></div>';
  }

  // KPI calc
  const pctPaid = Math.round(paid / echeanceTotal * 100);
  const tarif0 = getTarif(state, today);
  const aboElecTotal = tarif0.aboElec * 12 / 365 * stats.elapsed;
  const aboGazTotal  = tarif0.aboGaz  * 12 / 365 * stats.elapsed;
  const ctaTotal     = (tarif0.ctaElec + tarif0.ctaGaz) / 365 * stats.elapsed;
  const elecTotal    = stats.elecCost + aboElecTotal;
  const gazTotal     = stats.gasCost  + aboGazTotal;
  const paidColor    = paid >= echeanceTotal ? 'var(--green)' : paid >= stats.total ? 'var(--blue)' : 'var(--amber)';

  // Bloc fusionné : Consommé cycle + Prélevé échéancier
  const fusionEl = document.getElementById('db-fusion');
  if (fusionEl) {
    fusionEl.innerHTML =
      '<div class="card" style="margin-bottom:.75rem">' +
      '<div style="display:flex;gap:1rem;flex-wrap:wrap">' +

      // Colonne gauche : conso
      '<div style="flex:1;min-width:140px">' +
      '<div class="kpi-label">Consommé cycle</div>' +
      '<div style="font-family:var(--mono);font-size:26px;font-weight:600;color:var(--blue);margin:.3rem 0">' + f2(stats.total) + '</div>' +
      '<div style="font-size:11px;color:var(--text2);border-top:1px solid var(--border);padding-top:.4rem">' +
      '<div style="display:flex;justify-content:space-between;padding:.15rem 0">' +
      '<span>Élec <span style="color:var(--text3);font-size:10px">(abo ' + f2(aboElecTotal) + ')</span></span>' +
      '<span style="font-family:var(--mono)">' + f2(elecTotal) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:.15rem 0">' +
      '<span>Gaz <span style="color:var(--text3);font-size:10px">(abo ' + f2(aboGazTotal) + ')</span></span>' +
      '<span style="font-family:var(--mono)">' + f2(gazTotal) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:.15rem 0;color:var(--text3)">' +
      '<span>CTA proratisé</span><span style="font-family:var(--mono)">' + f2(ctaTotal) + '</span></div>' +
      '</div></div>' +

      // Séparateur vertical
      '<div style="width:1px;background:var(--border);flex-shrink:0"></div>' +

      // Colonne droite : prélevé
      (function() {
        const paidElec = (cycle.echElec || 0) * cycle.months * (paid / echeanceTotal);
        const paidGaz  = (cycle.echGaz  || 0) * cycle.months * (paid / echeanceTotal);
        return '<div style="flex:1;min-width:140px">' +
        '<div class="kpi-label">Prélevé échéancier</div>' +
        '<div style="font-family:var(--mono);font-size:26px;font-weight:600;color:' + paidColor + ';margin:.3rem 0">' + f2(paid) + '</div>' +
        '<div style="height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:.4rem">' +
        '<div style="height:5px;width:' + Math.min(pctPaid, 100) + '%;background:' + paidColor + ';border-radius:3px"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding-top:.4rem">' +
        (cycle.echElec ? '<div style="display:flex;justify-content:space-between;padding:.15rem 0"><span>Élec</span><span style="font-family:var(--mono)">' + f2(paidElec) + '</span></div>' : '') +
        (cycle.echGaz  ? '<div style="display:flex;justify-content:space-between;padding:.15rem 0"><span>Gaz</span><span style="font-family:var(--mono)">' + f2(paidGaz)  + '</span></div>' : '') +
        '<div style="display:flex;justify-content:space-between;padding:.15rem 0"><span>Reste</span><span style="font-family:var(--mono);color:var(--text2)">' + f2(Math.max(0, echeanceTotal - paid)) + '</span></div>' +
        '</div></div>';
      })() +

      '</div></div>';
  }

  // Tempo card seule dans kpi-grid
  const totalKwh = (by.blue.kwh + by.white.kwh + by.red.kwh) || 1;
  const mkTempoRow = (color, label, data) => {
    const pct = Math.round(data.kwh / totalKwh * 100);
    const cols = { blue: 'var(--blue)', white: '#9aa5b1', red: 'var(--red)' };
    return '<div style="margin-bottom:.35rem">' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">' +
      '<span class="badge b-' + color + '" style="font-size:9px">' + label + '</span>' +
      '<span style="font-family:var(--mono);color:var(--text2)">' + data.days + 'j · ' + f2(data.cost) + '</span>' +
      '</div>' +
      '<div style="height:5px;background:var(--bg4);border-radius:3px">' +
      '<div style="height:5px;width:' + pct + '%;background:' + cols[color] + ';border-radius:3px"></div>' +
      '</div>' +
      '</div>';
  };
  document.getElementById('db-kpi').innerHTML =
    '<div class="kpi" style="justify-content:flex-start;gap:.1rem">' +
    '<div class="kpi-label">Répartition Tempo</div>' +
    mkTempoRow('blue', 'Bleu', by.blue) +
    mkTempoRow('white', 'Blanc', by.white) +
    mkTempoRow('red', 'Rouge', by.red) +
    '</div>';

  // --- Extrapolation : fin de cycle + fin de mois empilés compacts ---
  const mkCompactCard = (title, total, ecClass, elecVal, gazVal, sub) =>
    '<div class="card" style="margin-bottom:.5rem;padding:.75rem 1rem">' +
    '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">' +
    '<div style="min-width:100px">' +
    '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.2rem">' + title + '</div>' +
    '<div style="font-family:var(--mono);font-size:24px;font-weight:700" class="' + ecClass + '">' + f2(total) + '</div>' +
    '</div>' +
    '<div style="flex:1;min-width:120px;font-size:11px;color:var(--text3);border-left:1px solid var(--border);padding-left:.75rem">' +
    '<div>Élec : <span style="color:var(--blue)">' + f2(elecVal) + '</span></div>' +
    '<div>Gaz+fixe : <span style="color:#f97316">' + f2(gazVal) + '</span></div>' +
    '<div style="margin-top:.2rem">' + sub + '</div>' +
    '</div>' +
    '</div></div>';

  const finCycleEl = document.getElementById('db-fin-cycle');
  const finMoisEl  = document.getElementById('db-fin-mois');
  if (!extrap) {
    if (finCycleEl) finCycleEl.innerHTML = '';
    if (finMoisEl)  finMoisEl.innerHTML  = '';
  } else {
    const diff = extrap.totalProjected - echeanceTotal;
    const ec   = diff <= 0 ? 'c-ok' : diff <= 150 ? 'c-warn' : 'c-danger';
    const cycleElecProj = extrap.months.reduce((s, m) => s + m.elecCost, 0);
    const cycleGazProj  = extrap.months.reduce((s, m) => s + m.gasCost + m.fixedCost, 0);
    const finCycleSub = 'Objectif ' + f2(echeanceTotal) + ' · Écart <span class="' + ec + '">' + (diff >= 0 ? '+' : '') + f2(diff) + '</span>';
    if (finCycleEl) finCycleEl.innerHTML = mkCompactCard('Extrapolation fin de cycle', extrap.totalProjected, ec, cycleElecProj, cycleGazProj, finCycleSub);

    const curMonth = extrap.months.find(m => m.status === 'partial') || extrap.months.find(m => m.status === 'estimated');
    if (curMonth && finMoisEl) {
      const moisDiff = curMonth.total - (echeanceTotal / 12);
      const mec = moisDiff <= 0 ? 'c-ok' : moisDiff <= 50 ? 'c-warn' : 'c-danger';
      const finMoisSub = curMonth.label + ' · Écart vs 1/12 <span class="' + mec + '">' + (moisDiff >= 0 ? '+' : '') + f2(moisDiff) + '</span>';
      finMoisEl.innerHTML = mkCompactCard('Extrapolation fin de mois', curMonth.total, mec, curMonth.elecCost, curMonth.gasCost + curMonth.fixedCost, finMoisSub);
    }
  }

  // Détail journalier
  const aboDay = (tarif0.aboElec + tarif0.aboGaz) * 12 / 365;
  const ctaDay = (tarif0.ctaElec + tarif0.ctaGaz) / 365;
  const elecDay = stats.elapsed > 0 ? stats.elecCost / stats.elapsed : 0;
  const gasDay = stats.elapsed > 0 ? stats.gasCost / stats.elapsed : 0;
  const totalDay = elecDay + gasDay + aboDay + ctaDay;
  const idealDay = echeanceTotal / 365;
  const diffDay = totalDay - idealDay;
  const diffColor = diffDay <= 0 ? 'var(--green)' : diffDay <= 0.5 ? 'var(--amber)' : 'var(--red)';
  document.getElementById('db-daily').innerHTML =
    irow('Électricité', fday(elecDay)) +
    irow('Gaz', fday(gasDay)) +
    irow('Abonnements proratisés', fday(aboDay)) +
    irow('CTA (élec+gaz)', fday(ctaDay)) +
    '<div class="sep"></div>' +
    irow('<strong>Total/jour réel</strong>', '<strong>' + fday(totalDay) + '</strong>') +
    irow('Idéal échéancier <span style="color:var(--text3);font-size:10px">(' + f2(echeanceTotal) + ' ÷ 365)</span>', fday(idealDay)) +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;font-size:12px">' +
    '<span style="color:var(--text3)">Écart réel vs idéal</span>' +
    '<span style="font-family:var(--mono);color:' + diffColor + ';font-weight:600">' + (diffDay >= 0 ? '+' : '') + fday(diffDay) + '</span>' +
    '</div>';

  // Graphe mensuel — barres bicolores + tooltip
  const realMonths = Object.keys(stats.monthlyData).sort();
  if (realMonths.length > 0) {
    const maxV = Math.max(...realMonths.map(m => { const md = stats.monthlyData[m]; return md.elec + md.gas + md.fixed; }));
    const bars = realMonths.map(m => {
      const md = stats.monthlyData[m];
      const total = md.elec + md.gas + md.fixed;
      const hTotal = maxV > 0 ? Math.round(total / maxV * 90) : 0;
      const hGaz  = maxV > 0 ? Math.round((md.gas + md.fixed) / maxV * 90) : 0;
      const hElec = Math.max(0, hTotal - hGaz);
      const label = m.slice(5) + '/' + m.slice(2, 4);
      return '<div class="month-bar-wrap" data-elec="' + md.elec.toFixed(2) + '" data-gaz="' + (md.gas + md.fixed).toFixed(2) + '" data-label="' + m + '">' +
        '<div class="month-bar-val">' + Math.round(total) + '</div>' +
        '<div class="month-bar-bg">' +
        '<div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:90px">' +
        '<div style="height:' + hElec + 'px;background:var(--blue);width:100%"></div>' +
        '<div style="height:' + hGaz  + 'px;background:#f97316;width:100%"></div>' +
        '</div></div>' +
        '<div class="month-bar-label">' + label + '</div>' +
        '</div>';
    }).join('');
    document.getElementById('db-months').innerHTML =
      '<div class="month-bars-wrap"><div class="month-bars" id="db-months-bars">' + bars + '</div></div>' +
      '<div style="display:flex;gap:1rem;font-size:10px;color:var(--text3);margin-top:.4rem;padding-left:.25rem">' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:var(--blue);border-radius:1px;margin-right:3px"></span>Élec</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;background:#f97316;border-radius:1px;margin-right:3px"></span>Gaz+fixe</span>' +
      '</div>';

    // Tooltip
    const tip = document.getElementById('db-tooltip');
    document.getElementById('db-months-bars').addEventListener('mousemove', e => {
      const bar = e.target.closest('[data-elec]');
      if (!bar || !tip) return;
      tip.innerHTML =
        '<span style="color:var(--text3)">' + bar.dataset.label + '</span><br>' +
        '<span style="color:var(--blue)">Élec</span> : <b>' + parseFloat(bar.dataset.elec).toFixed(2) + ' €</b><br>' +
        '<span style="color:#f97316">Gaz+fixe</span> : <b>' + parseFloat(bar.dataset.gaz).toFixed(2) + ' €</b>';
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY - 10) + 'px';
    });
    document.getElementById('db-months-bars').addEventListener('mouseleave', () => {
      if (tip) tip.style.display = 'none';
    });
  } else {
    document.getElementById('db-months').innerHTML = '<div style="color:var(--text3);font-size:12px">Pas encore de données.</div>';
  }

  // ─── Eau ────────────────────────────────────────────────────────────────
  const waterEl = document.getElementById('db-water');
  const waterCard = document.getElementById('db-water-card');
  if (waterEl) {
    const water = cycle.water || {};
    const waterDates = Object.keys(water).filter(d => d >= cycle.start && d <= today).sort();
    if (waterDates.length < 2) {
      waterCard && (waterCard.style.display = 'none');
    } else {
      waterCard && (waterCard.style.display = '');

      // Calcul basé sur les index bruts (évite les deltas corrompus)
      const lastDate  = waterDates[waterDates.length - 1];
      const lastIdx   = water[lastDate].idx_m3 || 0;
      const cycleStartIdx = cycle.indexStart.water_m3 || 0;

      // Total cycle = dernier index - index début de cycle
      const cycleTotalM3 = Math.max(0, lastIdx - cycleStartIdx);

      // Mois en cours : dernier idx du mois - premier idx du mois
      const lastMonthKey = today.slice(0, 7);
      const monthDates = waterDates.filter(d => d.startsWith(lastMonthKey));
      let monthM3 = 0;
      if (monthDates.length >= 2) {
        monthM3 = Math.max(0, water[monthDates[monthDates.length - 1]].idx_m3 - water[monthDates[0]].idx_m3);
      } else if (monthDates.length === 1) {
        // Un seul relevé dans le mois → référence = dernier relevé du mois précédent
        const prevMonthDates = waterDates.filter(d => d < lastMonthKey + '-01');
        const prevRef = prevMonthDates.length > 0
          ? water[prevMonthDates[prevMonthDates.length - 1]].idx_m3
          : cycleStartIdx;
        monthM3 = Math.max(0, water[monthDates[0]].idx_m3 - prevRef);
      }

      // Période des relevés (pour la moyenne journalière)
      const firstDate = waterDates[0];
      const d1 = new Date(firstDate), d2 = new Date(lastDate);
      const waterDays = Math.max(1, Math.round((d2 - d1) / 86400000));
      const totalPeriodM3 = Math.max(0, lastIdx - (water[firstDate].idx_m3 || cycleStartIdx));
      const avgDayL = (totalPeriodM3 / waterDays) * 1000;

      // Couleur seuils : ≤300 vert, >300 orange, >450 rouge
      const dayColor = avgDayL <= 300 ? 'var(--green)' : avgDayL <= 450 ? 'var(--amber)' : 'var(--red)';
      const alertType = avgDayL <= 300 ? null : avgDayL <= 450 ? 'warn' : 'danger';
      const alertMsg = alertType ? '<div class="alert alert-' + alertType + '" style="margin-bottom:.5rem">Surconsommation : ' + Math.round(avgDayL) + ' L/j (seuil 300 L/j)</div>' : '';

      const mkWm3 = (label, val) =>
        '<div style="flex:1;min-width:80px;background:var(--bg3);border-radius:var(--r);padding:.6rem;text-align:center">' +
        '<div style="font-size:10px;color:var(--text3);margin-bottom:.2rem">' + label + '</div>' +
        '<div style="font-family:var(--mono);font-size:18px;color:var(--text)">' + val.toFixed(1) + '<span style="font-size:11px"> m³</span></div>' +
        '</div>';

      waterEl.innerHTML =
        alertMsg +
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:80px;background:var(--bg3);border-radius:var(--r);padding:.6rem;text-align:center">' +
        '<div style="font-size:10px;color:var(--text3);margin-bottom:.2rem">Jour moy.</div>' +
        '<div style="font-family:var(--mono);font-size:18px;color:' + dayColor + '">' + Math.round(avgDayL) + '<span style="font-size:11px"> L</span></div>' +
        '</div>' +
        mkWm3('Mois en cours', monthM3) +
        mkWm3('Total cycle', cycleTotalM3) +
        '</div>' +
        '<div style="font-size:10px;color:var(--text3);margin-top:.4rem">' +
        'Réf. cycle : ' + cycleStartIdx + ' m³ · dernier relevé : ' + lastIdx + ' m³ (' + lastDate + ')' +
        ' · seuils : vert ≤300 · orange >300 · rouge >450 L/j</div>';
    }
  }

}
