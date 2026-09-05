/**
 * Device-level user interface + backup preference.  These sit outside the product data
 * (localStorage `dijii.compost.v1`) because they must survive a dataset switch and must
 * never be carried inside an exported JSON file.
 */
const KEY = "dijii.prefs.v1";

export type Business = {
  name: string;
  phone?: string;
  address?: string;
  /** Bank / wing line shown on the invoice footer. */
  paymentNote?: string;
};

export type Prefs = {
  /** Which dataset this device starts with; unset means "ask on first run". */
  started?: "demo" | "blank";
  contrast: "normal" | "high";
  /** ISO timestamp of the last JSON/CSV export, used by the backup warning. */
  lastExportAt?: string;
  business: Business;
};

export const defaultPrefs: Prefs = {
  contrast: "normal",
  business: { name: "កសិករទំនើប · ជីកំប៉ុស្តិ៍", paymentNote: "សូមបង់ប្រាក់ក្នុង ៣០ ថ្ងៃ។ សូមអរគុណដែលប្រើជីធម្មជាតិ។" },
};

export function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultPrefs };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      started: parsed.started === "demo" || parsed.started === "blank" ? parsed.started : undefined,
      contrast: parsed.contrast === "high" ? "high" : "normal",
      lastExportAt: typeof parsed.lastExportAt === "string" ? parsed.lastExportAt : undefined,
      business: {
        name: parsed.business?.name || defaultPrefs.business.name,
        phone: parsed.business?.phone,
        address: parsed.business?.address,
        paymentNote: parsed.business?.paymentNote,
      },
    };
  } catch {
    return { ...defaultPrefs };
  }
}

export function writePrefs(next: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode or a full quota: the app still works, the preference just is not kept
  }
}

export const stampExport = () => writePrefs({ ...readPrefs(), lastExportAt: new Date().toISOString() });

export function applyContrast(contrast: Prefs["contrast"]) {
  document.documentElement.dataset.contrast = contrast;
}

/** Download helper used by JSON and CSV exports. */
export function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
