import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
import { getCached, setCached, isFresh } from './cache';

export function Section({ title, meta, children, action }) {
  return (
    <section className="section">
      <header>
        <h2>{title}</h2>
        {action || (meta ? <span className="meta">{meta}</span> : null)}
      </header>
      {children}
    </section>
  );
}

export function Tag({ tone = 'quiet', children }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function Notice({ tone = 'info', children }) {
  if (!children) return null;
  return <div className={`notice ${tone}`}>{children}</div>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export function Field({ label, children }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Loading() {
  return <p className="empty">កំពុងផ្ទុក…</p>;
}

/**
 * ជ្រើសរើសដោយវាយស្វែងរក — ជំនួសបញ្ជីទម្លាក់ចុះធម្មតា (`<select>`)
 * សម្រាប់ករណីអតិថិជន/អ្នកផ្គត់ផ្គង់ដែលអាចមានឈ្មោះស្រដៀងគ្នា ឬចង់
 * ស្វែងរកតាមលេខទូរស័ព្ទ (បញ្ជីទម្លាក់ចុះស្ទួនឈ្មោះធ្វើឱ្យច្រឡំបានងាយ)។
 *
 * items: [{ id, label, sub }] — sub ជាធម្មតាជាលេខទូរស័ព្ទ
 * value: id ដែលបានជ្រើស (string/number) ឬ '' បើមិនទាន់ជ្រើស
 * onChange(id): ហៅពេលជ្រើសរើស ឬសម្អាត
 * onQuery(text): ស្រេចចិត្ត — ហៅរាល់ពេលអក្សរផ្លាស់ប្តូរ (សម្រាប់ស្វែងរកលើ
 *   ម៉ាស៊ីនមេ ពេលបញ្ជីធំពេក មិនអាចផ្ទុកមកគ្រប់ក្នុងម្តង)
 * filterLocally: បើ true (លំនាំដើម) filter `items` ខាងក្នុងដោយខ្លួនឯង —
 *   កំណត់ជា false បើ `items` ជាលទ្ធផលស្វែងរកពីម៉ាស៊ីនមេរួចហើយ
 */
export function SearchSelect({
  items, value, onChange, onQuery, placeholder = 'វាយឈ្មោះ ឬលេខទូរស័ព្ទ…',
  emptyOption, filterLocally = true,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // បើ value ត្រូវលុបចេញពីខាងក្រៅ (ឧ. form reset) សម្អាតស្លាកដែលបានជ្រើសដែរ
  useEffect(() => {
    if (value === '' || value == null) setSelectedLabel(null);
  }, [value]);

  const q = query.trim().toLowerCase();
  // លុបចន្លោះមុនប្រៀបធៀប — លេខទូរស័ព្ទបង្ហាញជា "012 345 678" ប៉ុន្តែអ្នកប្រើ
  // ជាធម្មតាវាយជាប់គ្នា "012345678" ដោយគ្មានចន្លោះ
  const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
  const qNorm = norm(q);
  const filtered = filterLocally && q
    ? items.filter((it) => norm(it.label).includes(qNorm) || norm(it.sub || '').includes(qNorm))
    : items;

  function pick(it) {
    onChange(it.id);
    setSelectedLabel(it.label);
    setQuery('');
    setOpen(false);
  }

  function clearSelection() {
    onChange(emptyOption ? emptyOption.id : '');
    setSelectedLabel(null);
    setQuery('');
  }

  const showValue = open ? query : (selectedLabel ?? '');
  const hasSelection = !open && selectedLabel !== null;

  return (
    <div className="search-select" ref={boxRef}>
      <div className="search-select-input-row">
        <input
          type="text"
          value={showValue}
          placeholder={selectedLabel ?? placeholder}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); onQuery?.(e.target.value); }}
        />
        {hasSelection && (
          <button type="button" className="search-select-clear" aria-label="សម្អាត"
                  onClick={clearSelection}>×</button>
        )}
      </div>

      {open && (
        <div className="search-select-list">
          {emptyOption && (!q || norm(emptyOption.label).includes(qNorm)) && (
            <button type="button" className="search-select-item"
                    onClick={() => pick(emptyOption)}>
              {emptyOption.label}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="search-select-empty">រកមិនឃើញ</div>
          ) : filtered.map((it) => (
            <button type="button" key={it.id} className="search-select-item" onClick={() => pick(it)}>
              <span>{it.label}</span>
              {it.sub && <span className="search-select-sub">{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ទាញទិន្នន័យ + ស្ថានភាពកំពុងផ្ទុក/កំហុស
 *
 * options:
 *   enabled — កំណត់ជា false ដើម្បីកុំឱ្យទាញ (ឧ. ផ្ទាំងដែលមិនទាន់បើក)
 *
 * បើមានច្បាប់ចម្លងក្នុងឃ្លាំង វាបង្ហាញភ្លាមដោយគ្មាន «កំពុងផ្ទុក…»
 * ហើយទាញថ្មីនៅខាងក្រោយបើទិន្នន័យចាស់ជាង ៣០ វិនាទី។
 *
 * ⚠️ ចំណុចសំខាន់ (កំហុសពិតដែលធ្លាប់កើត — «ម៉ឺនុយហិរញ្ញវត្ថុគាំង»):
 * ពេល `enabled` ប្តូរពី false → true (ឧ. អ្នកប្រើប្តូរផ្ទាំង), React
 * commit ការប្តូរនោះមុន រួចទើប run useEffect ក្រោយ។ មានន័យថាមាន render
 * មួយដងដែល `enabled=true` ខណៈ state `data`/`loading` ចាស់ (មិនទាន់ធ្វើ
 * បច្ចុប្បន្នភាព) នៅតែជា `null`/`false`។ បើទំព័រសរសេរ
 * `x.loading ? <Loading/> : x.data.length` គ្មានការពារ វានឹងព្យាយាមអាន
 * `null.length` ក្នុង render pass នោះ ធ្វើឱ្យ React គាំង។
 *
 * ដំណោះស្រាយ: មិនពឹងផ្អែកលើ state ដែល commit ហើយប៉ុណ្ណោះទេ — រាល់ render
 * ត្រួតពិនិត្យឃ្លាំងសម្ងាត់ស្រស់ៗផ្ទាល់ (មិនរង់ចាំ effect) ដូច្នេះបើ
 * cache មានស្រាប់ ទោះ `enabled` ទើបប្តូរក៏ដោយ ក៏បង្ហាញបានភ្លាមៗ។
 * បើគ្មាន cache ត្រូវបង្ហាញ loading=true ជានិច្ចរហូតទាល់តែមានទិន្នន័យ
 * ឬកំហុសពិតប្រាកដ — កុំបណ្តោយឱ្យ `data` ជា `null` ចេញទៅក្រៅ ខណៈ
 * `loading` ជា `false` ក្នុងពេលដំណាលគ្នា។
 */
export function useData(path, options = {}) {
  const { enabled = true } = options;

  const freshCache = enabled ? getCached(path) : null;
  const [data, setData] = useState(freshCache ? freshCache.data : null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled && !freshCache);

  // ការពារកុំឱ្យចម្លើយចាស់មកសរសេរជាន់លើ ពេលប្តូរទំព័រលឿន
  const reqId = useRef(0);

  const fetchNow = useCallback(
    (showSpinner) => {
      if (!enabled) return;
      const id = ++reqId.current;
      if (showSpinner) setLoading(true);
      setError('');

      api.get(path)
        .then((d) => {
          if (id !== reqId.current) return;
          setCached(path, d);
          setData(d);
          setLoading(false);
        })
        .catch((e) => {
          if (id !== reqId.current) return;
          setError(e.message);
          setLoading(false);
        });
    },
    [path, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    const entry = getCached(path);

    if (entry) {
      setData(entry.data);
      setLoading(false);
      if (!isFresh(entry)) fetchNow(false);
    } else {
      fetchNow(true);
    }
  }, [path, enabled, fetchNow]);

  const reload = useCallback(() => fetchNow(false), [fetchNow]);

  // តម្លៃដែលបង្ហាញចេញ — គណនាស្រស់រាល់ render កុំឱ្យ null+false កើតឡើងព្រមគ្នា
  const effectiveData = data !== null ? data : (freshCache ? freshCache.data : null);
  const effectiveLoading = !enabled ? false : (effectiveData === null && !error ? true : loading);

  return { data: effectiveData, error, loading: effectiveLoading, reload, setData };
}
