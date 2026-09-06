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
 * ទាញទិន្នន័យ + ស្ថានភាពកំពុងផ្ទុក/កំហុស
 *
 * options:
 *   enabled — កំណត់ជា false ដើម្បីកុំឱ្យទាញ (ឧ. ផ្ទាំងដែលមិនទាន់បើក)
 *
 * បើមានច្បាប់ចម្លងក្នុងឃ្លាំង វាបង្ហាញភ្លាមដោយគ្មាន «កំពុងផ្ទុក…»
 * ហើយទាញថ្មីនៅខាងក្រោយបើទិន្នន័យចាស់ជាង ៣០ វិនាទី។
 */
export function useData(path, options = {}) {
  const { enabled = true } = options;

  const cached = enabled ? getCached(path) : null;
  const [data, setData] = useState(cached ? cached.data : null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled && !cached);

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
        })
        .catch((e) => {
          if (id !== reqId.current) return;
          setError(e.message);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
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

  return { data, error, loading, reload, setData };
}
