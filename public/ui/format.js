const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const decimalCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function money(value, precise = false) { return (precise ? decimalCurrency : currency).format(Number.isFinite(value) ? value : 0); }
export function percent(value, digits = 0) { return `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`; }
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
export function gameTime(hours) {
  const day = Math.floor(hours / 24) + 1, hour = Math.floor(hours % 24), minute = Math.floor((hours % 1) * 60);
  return `DAY ${String(day).padStart(2, '0')} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export function moneySentence(e) { return `You earn ${money(e.revenue)}/h, spend ${money(e.costs, true)}/h, so you ${e.profit >= 0 ? 'profit' : 'lose'} ${money(Math.abs(e.profit), true)}/h.`; }
export function goalNumber(goal, value) { return goal.format === 'money' ? money(value) : goal.format === 'percent' ? percent(value, 1) : String(Math.floor(value)); }
export function signedMoney(value, precise = false) { return `${value >= 0 ? '+' : '−'}${money(Math.abs(value), precise)}`; }
export function ageText(hours) { const d = Math.floor(hours / 24), h = Math.floor(hours % 24); return d ? `${d}d ${h}h` : `${h}h`; }
export function hoursText(hours) { return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`; }
export function button(action, id, label, disabled, title, className = '') {
  return `<button data-action="${action}" data-value="${id}"${disabled ? ' disabled' : ''} title="${escapeHTML(title)}" class="${className}">${label}</button>`;
}
