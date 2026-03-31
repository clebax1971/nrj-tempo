export function f2(v) {
  return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €';
}

export function f1(v) {
  return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + ' kWh';
}

export function fday(v) {
  return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €/j';
}

export function irow(label, val) {
  return '<div class="irow"><span class="label">' + label + '</span><span class="val">' + val + '</span></div>';
}

export function kpiCard(val, label, sub, cls) {
  return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-val ' + cls + '">' + val + '</div><div class="kpi-sub">' + sub + '</div></div>';
}

export function tempoBar(color, label, data, totalKwh) {
  const pct = totalKwh > 0 ? Math.round(data.kwh / totalKwh * 100) : 0;
  const cols = { blue: 'var(--blue)', white: 'var(--white)', red: 'var(--red)' };
  return irow('<span class="badge b-' + color + '">' + label + '</span> (' + data.days + ' j)', f1(data.kwh) + ' — ' + f2(data.cost)) +
    '<div class="prog-wrap"><div class="prog-bg"><div class="prog-fill" style="width:' + pct + '%;background:' + cols[color] + '"></div></div></div>';
}


export function showMsg(msg, elementId) {
  const el = document.getElementById(elementId || 'config-msg');
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3500);
}
