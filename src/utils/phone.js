/**
 * លេខទូរស័ព្ទកម្ពុជា — normalize ស្វ័យប្រវត្តិ
 * ដោះស្រាយបញ្ហា format លេខទូរស័ព្ទដែលធ្លាប់កើតក្នុងប្រព័ន្ធចាស់
 * (០ ដើមបាត់, ចន្លោះ, សញ្ញា -, +855 លាយគ្នា, Sheets យកជាលេខ)
 *
 * លទ្ធផល: { e164: '+85512345678', display: '012 345 678' }
 */

export function normalizePhone(input) {
  if (input === null || input === undefined || input === '') return null;

  // ១. យកតែតួលេខ (រក្សា + ដើមបើមាន)
  let s = String(input).trim();
  const hadPlus = s.startsWith('+');
  let digits = s.replace(/\D/g, '');

  if (!digits) return null;

  // ២. ដោះស្រាយ prefix ប្រទេស
  if (hadPlus || digits.startsWith('855')) {
    digits = digits.replace(/^855/, '');
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);           // លុប ០ ដើមក្នុងស្រុក
  }

  // ៣. ត្រួតពិនិត្យប្រវែង (លេខចល័តកម្ពុជា ៨–៩ ខ្ទង់ ក្រោយដក ០)
  if (digits.length < 8 || digits.length > 9) {
    return { e164: null, display: String(input).trim(), valid: false };
  }

  const e164 = `+855${digits}`;

  // ៤. Format បង្ហាញ: 0XX XXX XXX / 0XX XXX XXXX
  const local = `0${digits}`;
  const display =
    local.length === 9
      ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
      : `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;

  return { e164, display, valid: true };
}

/** ប្រើពេលចង់បដិសេធទិន្នន័យខុសមិនឱ្យចូល DB */
export function requireValidPhone(input, fieldLabel = 'លេខទូរស័ព្ទ') {
  const p = normalizePhone(input);
  if (!p) return { e164: null, display: null };
  if (!p.valid) {
    const err = new Error(`${fieldLabel} មិនត្រឹមត្រូវ: "${input}" (ឧ. 012 345 678)`);
    err.status = 400;
    throw err;
  }
  return p;
}
