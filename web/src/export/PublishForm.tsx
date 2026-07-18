import { useState } from 'react';
import { publishToMarketplace } from '../api/client';

export interface PublishFormProps {
  code: string;
  blenderCode: string;
}

export function PublishForm({ code, blenderCode }: PublishFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const canPublish = title.trim().length > 0 && code.length > 0 && status !== 'publishing';

  async function handlePublish() {
    setStatus('publishing');
    setErrorMsg('');
    try {
      await publishToMarketplace({ title: title.trim(), description: description.trim(), code, blenderCode });
      setStatus('success');
      setTitle('');
      setDescription('');
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message || 'Publish failed');
    }
  }

  if (status === 'success') {
    return <p className="hint">Published! Your scene is now on the Marketplace.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="text"
        placeholder="Title (required)"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="Description (optional)"
        maxLength={1000}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ resize: 'vertical' }}
      />
      <button type="button" disabled={!canPublish} onClick={() => void handlePublish()}>
        {status === 'publishing' ? 'Publishing…' : 'Publish'}
      </button>
      {status === 'error' && <p className="hint" style={{ color: 'var(--error, #f66)' }}>{errorMsg}</p>}
    </div>
  );
}
