import { useState } from 'react';
import { publishToMarketplace } from '../api/client';
import { Button } from './ui/Button';
import { FIELD } from './ui/Input';

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
    return <p className="m-0 text-[13px] leading-normal text-text-faint">Published! Your scene is now on the Marketplace.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        className={FIELD}
        placeholder="Title (required)"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className={`resize-y ${FIELD}`}
        placeholder="Description (optional)"
        maxLength={1000}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button variant="primary" type="button" disabled={!canPublish} onClick={() => void handlePublish()}>
        {status === 'publishing' ? 'Publishing…' : 'Publish'}
      </Button>
      {status === 'error' && <p className="m-0 text-[14px] leading-relaxed text-red-400">{errorMsg}</p>}
    </div>
  );
}
