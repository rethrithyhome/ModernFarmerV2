import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

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

/** ទាញទិន្នន័យ + ស្ថានភាពកំពុងផ្ទុក/កំហុស ក្នុងកន្លែងតែមួយ */
export function useData(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    api.get(path)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(reload, [reload, ...deps]);
  return { data, error, loading, reload, setData };
}

export function Loading() {
  return <p className="empty">កំពុងផ្ទុក…</p>;
}
