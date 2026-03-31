import { TEMPO_CAL, tempoColor } from './tempo-cal.js';

export function getTarif(state, dateStr) {
  const sorted = state.tarifs.slice().sort((a,b) => b.dateEffet.localeCompare(a.dateEffet));
  for(const t of sorted) { if(dateStr >= t.dateEffet) return t; }
  return sorted[sorted.length-1];
}

export function elecCostForEntry(e, tarif) {
  return e.hcb*tarif.bhc + e.hpb*tarif.bhp +
         e.hcw*tarif.whc + e.hpw*tarif.whp +
         e.hcr*tarif.rhc + e.hpr*tarif.rhp;
}

export function computeCycleStats(cycle, upToDate, state) {
  const today = upToDate || new Date().toISOString().slice(0,10);
  const start = cycle.start;
  const end = cycle.end;
  const totalDays = daysBetween(start, end);
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(start, today)));

  let elecCost=0, elecKwh=0, gasCost=0, gasKwh=0;
  const monthlyData={};

  // Élec
  for(const [d, e] of Object.entries(cycle.elec)) {
    if(d < start || d > today) continue;
    const tarif = getTarif(state, d);
    const cost = elecCostForEntry(e, tarif);
    const kwh = (e.hcb||0)+(e.hpb||0)+(e.hcw||0)+(e.hpw||0)+(e.hcr||0)+(e.hpr||0);
    elecCost += cost; elecKwh += kwh;
    const m = d.slice(0,7);
    if(!monthlyData[m]) monthlyData[m]={elec:0,gas:0,fixed:0};
    monthlyData[m].elec += cost;
  }

  // Gaz
  for(const [d, g] of Object.entries(cycle.gas)) {
    if(d < start || d > today) continue;
    const tarif = getTarif(state, d);
    const cost = g.kwh * tarif.gazKwh;
    gasCost += cost; gasKwh += g.kwh;
    const m = d.slice(0,7);
    if(!monthlyData[m]) monthlyData[m]={elec:0,gas:0,fixed:0};
    monthlyData[m].gas += cost;
  }

  // Charges fixes proratisées
  const tarif0 = getTarif(state, today);
  const fixedPerDay = (tarif0.aboElec + tarif0.aboGaz)*12/365 + (tarif0.ctaElec + tarif0.ctaGaz)/365;
  const fixedTotal = fixedPerDay * elapsed;

  // Répartir le fixe sur les mois
  for(const m of Object.keys(monthlyData)) {
    const daysInMonth = Object.keys(cycle.elec).filter(d=>d.startsWith(m)&&d>=start&&d<=today).length || 30;
    monthlyData[m].fixed = fixedPerDay * daysInMonth;
  }

  const total = elecCost + gasCost + fixedTotal;
  const avgDay = elapsed > 0 ? total / elapsed : 0;

  return {elecCost, elecKwh, gasCost, gasKwh, fixedTotal, fixedPerDay, total, avgDay, elapsed, totalDays, monthlyData};
}

export function computeExtrap(cycle, state) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = state.refCycles && state.refCycles[0];
  const POSITIONS = 12;
  const DAYS_PER_POS = 30;

  // Fallback si pas de cycle de référence
  if (!ref) return null;

  // --- Étape 1 : Agréger consommation réelle par position (tranches de 30j) ---
  const actualElec = Array.from({length: POSITIONS}, () => ({hcb:0,hpb:0,hcw:0,hpw:0,hcr:0,hpr:0,kwh:0}));
  const actualGasKwh = Array(POSITIONS).fill(0);

  for (const [d, e] of Object.entries(cycle.elec)) {
    if (d < cycle.start || d > today) continue;
    const pos = Math.min(Math.floor(daysBetween(cycle.start, d) / DAYS_PER_POS), POSITIONS - 1);
    ['hcb','hpb','hcw','hpw','hcr','hpr'].forEach(f => { actualElec[pos][f] += e[f] || 0; });
    actualElec[pos].kwh += (e.hcb||0)+(e.hpb||0)+(e.hcw||0)+(e.hpw||0)+(e.hcr||0)+(e.hpr||0);
  }
  for (const [d, g] of Object.entries(cycle.gas)) {
    if (d < cycle.start || d > today) continue;
    const pos = Math.min(Math.floor(daysBetween(cycle.start, d) / DAYS_PER_POS), POSITIONS - 1);
    actualGasKwh[pos] += g.kwh || 0;
  }

  // --- Étape 2 : Positions complètes / en cours / futures ---
  const elapsedDays = daysBetween(cycle.start, today);
  const completePositions = Math.min(Math.floor(elapsedDays / DAYS_PER_POS), POSITIONS);
  const currentPos = Math.min(completePositions, POSITIONS - 1);
  const daysInCurrentPos = elapsedDays % DAYS_PER_POS;

  // --- Étape 3 : Pace ratios sur positions complètes ---
  let c1ElecComplete = 0, c2ElecComplete = 0;
  let c1GasComplete = 0, c2GasComplete = 0;

  for (let p = 0; p < completePositions; p++) {
    const c1e = ref.elec_detail[p];
    c1ElecComplete += c1e.hcb+c1e.hpb+c1e.hcw+c1e.hpw+c1e.hcr+c1e.hpr;
    c2ElecComplete += actualElec[p].kwh;
    c1GasComplete += ref.gas_kwh[p];
    c2GasComplete += actualGasKwh[p];
  }

  const paceElec = c1ElecComplete > 0 ? c2ElecComplete / c1ElecComplete : 1;
  const paceGas  = c1GasComplete  > 0 ? c2GasComplete  / c1GasComplete  : 1;

  // Fiabilité : % du gaz C1 couvert par les mois complets (gaz = indicateur dominant)
  const c1GasTotal = ref.gas_kwh.reduce((s, v) => s + v, 0);
  const pctGasCovered = c1GasTotal > 0 ? c1GasComplete / c1GasTotal : 0;
  // ±30% avant nov, ±15% jusqu'en jan, ±8% après fév, ±5% après avr
  const reliability = pctGasCovered < 0.08 ? 30
    : pctGasCovered < 0.5 ? 15
    : pctGasCovered < 0.72 ? 8
    : 5;

  // --- Étape 4 : Tableau mois par mois ---
  const months = [];

  for (let p = 0; p < POSITIONS; p++) {
    // Date de début de cette position
    const posDate = new Date(cycle.start + 'T12:00:00');
    posDate.setDate(posDate.getDate() + p * DAYS_PER_POS);
    const posDateStr = posDate.toISOString().slice(0, 10);
    const label = posDate.toLocaleDateString('fr-FR', {month:'short', year:'2-digit'});
    const tarif = getTarif(state, posDateStr);
    const c1e = ref.elec_detail[p];
    const c1eKwh = c1e.hcb+c1e.hpb+c1e.hcw+c1e.hpw+c1e.hcr+c1e.hpr;
    const c1gKwh = ref.gas_kwh[p];
    // Coût unitaire élec C1 par kWh (pour projeter la répartition HC/HP)
    const c1ElecUnitCost = c1eKwh > 0 ? elecCostForEntry(c1e, tarif) / c1eKwh : 0;

    if (p < completePositions) {
      // --- Réel complet ---
      const elec = actualElec[p];
      const elecCost = elecCostForEntry(elec, tarif);
      const gasCost  = actualGasKwh[p] * tarif.gazKwh;
      const fixedCost = (tarif.aboElec + tarif.aboGaz) + (tarif.ctaElec + tarif.ctaGaz) / 12;
      months.push({ pos:p, label, status:'real',
        elecKwh: elec.kwh, gasKwh: actualGasKwh[p],
        elecCost, gasCost, fixedCost, total: elecCost + gasCost + fixedCost });

    } else if (p === currentPos && daysInCurrentPos > 0) {
      // --- Partiel : Option B (réel + complément estimé) ---
      const fracEst = (DAYS_PER_POS - daysInCurrentPos) / DAYS_PER_POS;
      const elecReal = actualElec[p];
      const gasRealKwh = actualGasKwh[p];
      const elecEstKwh = c1eKwh * paceElec * fracEst;
      const gasEstKwh  = c1gKwh * paceGas  * fracEst;
      const elecCost = elecCostForEntry(elecReal, tarif) + c1ElecUnitCost * elecEstKwh;
      const gasCost  = (gasRealKwh + gasEstKwh) * tarif.gazKwh;
      const fixedCost = (tarif.aboElec + tarif.aboGaz) + (tarif.ctaElec + tarif.ctaGaz) / 12;
      months.push({ pos:p, label, status:'partial',
        elecKwh: elecReal.kwh + elecEstKwh, gasKwh: gasRealKwh + gasEstKwh,
        elecCost, gasCost, fixedCost, total: elecCost + gasCost + fixedCost });

    } else {
      // --- Estimé ---
      const elecEstKwh = c1eKwh * paceElec;
      const gasEstKwh  = c1gKwh * paceGas;
      const elecCost = c1ElecUnitCost * elecEstKwh;
      const gasCost  = gasEstKwh * tarif.gazKwh;
      const fixedCost = (tarif.aboElec + tarif.aboGaz) + (tarif.ctaElec + tarif.ctaGaz) / 12;
      months.push({ pos:p, label, status:'estimated',
        elecKwh: elecEstKwh, gasKwh: gasEstKwh,
        elecCost, gasCost, fixedCost, total: elecCost + gasCost + fixedCost });
    }
  }

  const totalProjected = months.reduce((s, m) => s + m.total, 0);
  const totalReal = months.filter(m => m.status === 'real').reduce((s, m) => s + m.total, 0);

  return {
    months, totalProjected, totalReal,
    paceElec, paceGas,
    completePositions, reliability,
    c1ElecComplete, c2ElecComplete,
    c1GasComplete, c2GasComplete
  };
}

export function computeTempoBreakdown(cycle, state) {
  const today = new Date().toISOString().slice(0,10);
  const by = {blue:{kwh:0,cost:0,days:0},white:{kwh:0,cost:0,days:0},red:{kwh:0,cost:0,days:0}};
  for(const [d, e] of Object.entries(cycle.elec)) {
    if(d < cycle.start || d > today) continue;
    const color = e.color || tempoColor(d);
    const tarif = getTarif(state, d);
    const cost = elecCostForEntry(e, tarif);
    const kwh = (e.hcb||0)+(e.hpb||0)+(e.hcw||0)+(e.hpw||0)+(e.hcr||0)+(e.hpr||0);
    by[color].kwh += kwh; by[color].cost += cost; by[color].days += 1;
  }
  return by;
}

export function daysBetween(d1, d2) {
  return Math.max(0, Math.round((new Date(d2+'T12:00:00') - new Date(d1+'T12:00:00')) / 86400000));
}

export function generateAlerts(stats, extrap, paid, echeanceTotal, by, state, cycle) {
  const alerts = [];

  // 1. Dépassement budget actuel
  const gapPaid = stats.total - paid;
  if (gapPaid > 50) {
    alerts.push({type:'danger', message:'Dépassement de '+f2(gapPaid)+' par rapport aux prélèvements effectués.'});
  }

  // 2. Projection fin de cycle (nouveau modèle saisonnier)
  if (extrap && extrap.totalProjected) {
    const diffCycle = extrap.totalProjected - echeanceTotal;
    const reliab = extrap.reliability ? ' (±'+extrap.reliability+'%)' : '';
    if (diffCycle > 100) {
      alerts.push({type:'danger', message:'Projection fin de cycle'+reliab+' : dépassement estimé de '+f2(diffCycle)+'.'});
    } else if (diffCycle > 0) {
      alerts.push({type:'warn', message:'Projection fin de cycle'+reliab+' légèrement au-dessus de l\'échéancier (+'+f2(diffCycle)+').'});
    } else {
      alerts.push({type:'ok', message:'Projection sous contrôle'+reliab+' — économie estimée de '+f2(Math.abs(diffCycle))+' à la régularisation.'});
    }
  }

  // 3. Jours rouges
  const totalElecKwh = ((by?.blue?.kwh||0)+(by?.white?.kwh||0)+(by?.red?.kwh||0))||1;
  const pctRed = (by?.red?.kwh||0)/totalElecKwh*100;
  if (pctRed > 15) {
    alerts.push({type:'warn', message:'Jours rouges : '+Math.round(pctRed)+'% de votre conso élec ('+f2(by.red.cost)+').'});
  }

  if (alerts.length === 0) {
    alerts.push({type:'ok', message:'RAS — votre consommation est sous contrôle.'});
  }
  return alerts;
}

export function generateRecommendations(stats, by, extrap, state) {
  const MIN_SAVING = 5;
  const recos = [];
  const today = new Date().toISOString().slice(0,10);
  const tarif = getTarif(state, today);
  if (!tarif) return recos;

  // A. Jours rouges
  const totalElecKwh = ((by?.blue?.kwh||0)+(by?.white?.kwh||0)+(by?.red?.kwh||0))||1;
  const pctRed = (by?.red?.kwh||0)/totalElecKwh*100;
  if (pctRed > 10 && (by?.red?.cost||0) > 0) {
    const saving = (by.red.kwh*0.5)*(tarif.rhp-tarif.bhp);
    if (saving >= MIN_SAVING) {
      recos.push({message:'Réduire la conso en <b>heures pleines rouges</b> de moitié → économie estimée <b>'+f2(saving)+'</b> sur le cycle.'});
    }
  }

  // B. Pace élec > 1.1 : tendance à la hausse vs C1
  if (extrap && extrap.paceElec > 1.1) {
    const surplus = (extrap.totalProjected - extrap.totalProjected / extrap.paceElec) * 0.5;
    if (surplus >= MIN_SAVING) {
      recos.push({message:'Votre rythme élec est <b>'+Math.round(extrap.paceElec*100)+'%</b> de la référence. Réduire de 10% économiserait ~<b>'+f2(extrap.totalProjected*0.05)+'</b>.'});
    }
  }

  // C. HP >> HC
  const totalHC = (stats.elecKwh - (by?.blue?.kwh||0)*0 + 0);
  const hcTotal = Object.values(by||{}).reduce((s,b)=>s+(b.hc||0),0);
  const hpTotal = Object.values(by||{}).reduce((s,b)=>s+(b.hp||0),0);
  const pctHP = hpTotal/((hcTotal+hpTotal)||1)*100;
  if (pctHP > 70 && stats.elecKwh > 50) {
    const saving = stats.elecKwh*0.15*(tarif.bhp-tarif.bhc);
    if (saving >= MIN_SAVING) {
      recos.push({message:'Déplacer <b>15% de la conso</b> vers les heures creuses (22h–6h) → ~<b>'+f2(saving)+'</b> d\'économie.'});
    }
  }

  if (recos.length === 0) {
    recos.push({message:'Aucune optimisation évidente pour le moment.'});
  }
  return recos;
}

// Internal helpers used in alerts/recos
function f2(v) { return (Math.round(v*100)/100).toFixed(2).replace('.',',')+' €'; }
function fday(v) { return (Math.round(v*100)/100).toFixed(2).replace('.',',')+' €/j'; }
