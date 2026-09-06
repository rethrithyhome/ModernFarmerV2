/**
 * រូបិយប័ណ្ណ និងទម្រង់លុយ
 *
 * ដាច់ដោយឡែកពី api.js ដើម្បីកុំឱ្យពឹងផ្អែកលើអ្វីផ្សេង —
 * ធ្វើឱ្យតេស្តបាន និងនាំចូលបានពីគ្រប់ទីកន្លែង។
 */

const CURRENCY_KEY = 'mf_currency';

const store = typeof localStorage !== 'undefined' ? localStorage : null;
let currency = store?.getItem(CURRENCY_KEY) || 'KHR';

export function getCurrency() {
  return currency;
}

export function setCurrency(c) {
  if (c !== 'KHR' && c !== 'USD') return;
  currency = c;
  store?.setItem(CURRENCY_KEY, c);
}

/** និមិត្តសញ្ញាសម្រាប់ស្លាកទម្រង់បញ្ចូល ឧ. «តម្លៃលក់ (៛)» */
export function currencyLabel() {
  return currency === 'KHR' ? '៛' : '$';
}

/**
 * ទម្រង់លុយ រួមទាំងនិមិត្តសញ្ញា
 * រៀល:   100,000៛  (គ្មានទសភាគ ព្រោះរៀលមិនប្រើសេន)
 * ដុល្លារ: $25.00
 */
export function money(n) {
  const v = Number(n || 0);
  if (currency === 'KHR') {
    return `${Math.round(v).toLocaleString('en-US')}៛`;
  }
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** ជំហានសមរម្យសម្រាប់ប្រអប់បញ្ចូលលុយ */
export function moneyStep() {
  return currency === 'KHR' ? '100' : 'any';
}
