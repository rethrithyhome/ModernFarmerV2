/**
 * ក្រាហ្វិកសាមញ្ញ — SVG ដោយផ្ទាល់ គ្មាន library ខាងក្រៅ
 *
 * ហេតុអ្វីមិនប្រើ library ក្រាហ្វិក? កម្មវិធីនេះជា PWA សម្រាប់ប្រើលើទូរស័ព្ទ
 * នៅរោងចក្រ ជួនកាលអ៊ីនធឺណិតយឺត។ library ក្រាហ្វិកទូទៅមានទំហំធំ (100KB+)
 * សម្រាប់តម្រូវការសាមញ្ញគ្រាន់តែបន្ទាត់ និងជញ្ជាំង។ SVG ដោយផ្ទាល់តូចជាង
 * ១០ដង ហើយគ្រប់គ្រាន់សម្រាប់ទិន្នន័យអាជីវកម្មខ្នាតតូច។
 */

const W = 320, H = 120, PAD = 8;

/** បន្ទាត់និន្នាការ — ប្រើសម្រាប់ចំណូលតាមថ្ងៃ */
export function TrendLine({ points, formatValue = (v) => v, formatLabel = (l) => l }) {
  if (!points || points.length === 0) return null;

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = 0; // ចំណូលមិនអវិជ្ជមាន — ចាប់ផ្តើមពី ០ ជានិច្ចដើម្បីកុំបំភ្លៃទំហំ
  const range = max - min || 1;

  const stepX = (W - PAD * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - ((p.value - min) / range) * (H - PAD * 2),
    ...p,
  }));

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${H - PAD} L ${coords[0].x.toFixed(1)} ${H - PAD} Z`;

  const last = coords[coords.length - 1];
  const peak = coords.reduce((a, b) => (b.value > a.value ? b : a), coords[0]);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none" role="img"
           aria-label={`និន្នាការពី ${formatLabel(points[0].label)} ដល់ ${formatLabel(points[points.length - 1].label)}`}>
        {/* បន្ទាត់ជញ្ជាំង ០ */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="chart-axis" />
        <path d={area} className="chart-area" />
        <path d={path} className="chart-line" />
        {/* ចំណុចថ្ងៃចុងក្រោយ ណាំមាន */}
        <circle cx={last.x} cy={last.y} r="3" className="chart-dot" />
        {peak.value > 0 && peak !== last && (
          <circle cx={peak.x} cy={peak.y} r="2.5" className="chart-dot-peak" />
        )}
      </svg>
      <div className="chart-legend">
        <span>{formatLabel(points[0].label)}</span>
        <span className="chart-legend-mid">
          កំពូល {formatValue(peak.value)}
        </span>
        <span>{formatLabel(points[points.length - 1].label)}</span>
      </div>
    </div>
  );
}

/** ជញ្ជាំងផ្ដេក — ប្រើសម្រាប់ការលក់តាមផលិតផល (ដូចជួរបញ្ជីធម្មតា តែមានបន្ទាត់ចំណុះ) */
export function HorizontalBars({ items, formatValue = (v) => v, max: maxOverride }) {
  if (!items || items.length === 0) return null;
  const max = maxOverride ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="hbar-list">
      {items.map((it, i) => {
        const pct = max > 0 ? Math.min((it.value / max) * 100, 100) : 0;
        return (
          <div className="hbar-row" key={i}>
            <div className="hbar-label">
              <span>{it.label}</span>
              <span className="num">{formatValue(it.value)}</span>
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
