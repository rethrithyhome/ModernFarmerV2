import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import type { DbShape, Lot } from "../lib/types";
import { recipeById } from "../lib/engine";

/**
 * QR payload for a lot. The token is stable across domains, so a label printed
 * in the plant still opens the right lot after a republish.
 */
export const lotUrl = (lot: Lot) => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?lot=${encodeURIComponent(lot.id)}`;
};

export function useQr(text: string, size = 512) {
  const [value, setValue] = useState<{ text: string; url: string | null; error: boolean }>({
    text,
    url: null,
    error: false,
  });

  useEffect(() => {
    let alive = true;
    toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#241c12ff", light: "#fffdf7ff" },
    })
      .then((url) => {
        if (alive) setValue({ text, url, error: false });
      })
      .catch(() => {
        if (alive) setValue({ text, url: null, error: true });
      });
    return () => {
      alive = false;
    };
  }, [text, size]);

  return value;
}

export function Qr({ text, size = 132 }: { text: string; size?: number }) {
  const qr = useQr(text, size * 3);
  if (qr.error) return <p className="empty">មិនអាចបង្កើត QR បានទេ</p>;
  if (!qr.url || qr.text !== text)
    return <span className="qr qr--loading" style={{ width: size, height: size }} aria-hidden="true" />;
  return (
    <img
      className="qr"
      src={qr.url}
      width={size}
      height={size}
      alt={`QR ${text}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Lot fields printed on the windrow sticker. */
export function labelFacts(db: DbShape, lot: Lot) {
  const recipe = recipeById(db, lot.recipeId);
  return {
    code: lot.code,
    recipe: recipe?.name ?? "—",
    product: recipe?.productName ?? "—",
    start: lot.startDate,
    target: lot.targetDate,
    plannedKg: lot.plannedKg,
    actualKg: lot.actualKg,
    windrow: lot.windrow || "—",
    url: lotUrl(lot),
  };
}

/** Print only what is inside `.print-zone` (see the print rules in styles.css). */
export function printLabels() {
  document.body.classList.add("printing");
  const done = () => {
    document.body.classList.remove("printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  // Safari/Firefox can skip afterprint when the dialog is dismissed
  window.setTimeout(done, 4000);
}
