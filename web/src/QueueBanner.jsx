import { useEffect, useState } from 'react';
import { subscribe, listQueue, startAutoSync, sync, dismissFailed, retryFailed } from './offline';
import { store } from './api';

/**
 * បង្ហាញស្ថានភាពជួរសំណើរង់ចាំ។
 * លាក់ទាំងស្រុងពេលគ្មានអ្វីរង់ចាំ — កុំរំខានពេលអ្វីៗដំណើរការធម្មតា។
 */
export default function QueueBanner({ onSynced }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listQueue().then(setItems);
    const off = subscribe(setItems);
    const stop = startAutoSync(() => store.token, (r) => { if (r.sent) onSynced?.(r); });
    return () => { off(); stop(); };
  }, [onSynced]);

  const pending = items.filter((i) => i.state === 'pending');
  const failed = items.filter((i) => i.state === 'failed');
  if (pending.length === 0 && failed.length === 0) return null;

  async function syncNow() {
    setBusy(true);
    const r = await sync(() => store.token);
    setBusy(false);
    if (r.sent) onSynced?.(r);
  }

  return (
    <div className={`queue ${failed.length ? 'has-failed' : ''}`}>
      <button className="queue-head" onClick={() => setOpen(!open)}>
        <span>
          {pending.length > 0 && `${pending.length} សំណើរង់ចាំផ្ញើ`}
          {pending.length > 0 && failed.length > 0 && ' · '}
          {failed.length > 0 && `${failed.length} បរាជ័យ`}
        </span>
        <span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>

      {open && (
        <div className="queue-body">
          {pending.map((i) => (
            <div className="queue-item" key={i.id}>
              <span>{i.label}</span>
              <span className="queue-state">រង់ចាំ</span>
            </div>
          ))}
          {failed.map((i) => (
            <div className="queue-item failed" key={i.id}>
              <span>{i.label}</span>
              <span className="queue-state">{i.error}</span>
            </div>
          ))}

          <div className="queue-actions">
            {pending.length > 0 && (
              <button className="btn small" disabled={busy || !navigator.onLine} onClick={syncNow}>
                {busy ? 'កំពុងផ្ញើ…' : 'ផ្ញើឥឡូវ'}
              </button>
            )}
            {failed.length > 0 && (
              <>
                <button className="btn small ghost" onClick={() => retryFailed()}>
                  ព្យាយាមម្តងទៀត
                </button>
                <button className="btn small ghost" onClick={() => dismissFailed()}>
                  លុបចោលទាំងអស់
                </button>
              </>
            )}
          </div>

          {failed.length > 0 && (
            <p className="queue-note">
              សំណើបរាជ័យមិនត្រូវបានកត់ត្រាទេ។ ពិនិត្យមូលហេតុខាងលើ រួចធ្វើឡើងវិញដោយដៃ។
            </p>
          )}
        </div>
      )}
    </div>
  );
}
