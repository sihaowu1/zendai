import { useMemo, useState } from 'react';
import { publishToMarketplace } from '../api/client';
import type { SceneModel } from '../state/useSceneProject';
import { Button } from './ui/Button';
import { FIELD, FIELD_LABEL } from './ui/Input';

export interface PublishFormProps {
  models: SceneModel[];
  /** Prefer this model when the form mounts. */
  defaultModelId?: string;
}

export function PublishForm({ models, defaultModelId }: PublishFormProps) {
  const publishable = useMemo(
    () => models.filter((m) => m.code.trim().length > 0),
    [models],
  );
  const initialModelId =
    (defaultModelId && publishable.some((m) => m.id === defaultModelId) ? defaultModelId : null) ??
    publishable[0]?.id ??
    '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [modelId, setModelId] = useState(initialModelId);
  const [animationId, setAnimationId] = useState('');
  const [status, setStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedModel = publishable.find((m) => m.id === modelId) ?? publishable[0];
  const animations = selectedModel?.animations ?? [];

  const canPublish =
    title.trim().length > 0 &&
    Boolean(selectedModel?.code) &&
    status !== 'publishing';

  function handleModelChange(nextId: string) {
    setModelId(nextId);
    setAnimationId('');
  }

  async function handlePublish() {
    if (!selectedModel) return;
    setStatus('publishing');
    setErrorMsg('');
    try {
      const anim = animations.find((a) => a.id === animationId);
      await publishToMarketplace({
        title: title.trim(),
        description: description.trim(),
        code: selectedModel.code,
        ...(anim
          ? { animationCode: anim.code, animationName: anim.name }
          : {}),
      });
      setStatus('success');
      setTitle('');
      setDescription('');
      setAnimationId('');
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message || 'Publish failed');
    }
  }

  if (publishable.length === 0) {
    return (
      <p className="m-0 text-[13px] leading-normal text-text-faint">
        Generate a scene first to publish it.
      </p>
    );
  }

  if (status === 'success') {
    return (
      <p className="m-0 text-[13px] leading-normal text-text-faint">
        Published! Your scene is now on the Marketplace.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={FIELD_LABEL}>
        Model
        <select
          className={FIELD}
          value={selectedModel?.id ?? ''}
          onChange={(e) => handleModelChange(e.target.value)}
        >
          {publishable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className={FIELD_LABEL}>
        Animation (optional)
        <select
          className={FIELD}
          value={animationId}
          onChange={(e) => setAnimationId(e.target.value)}
          disabled={animations.length === 0}
        >
          <option value="">
            {animations.length === 0 ? 'No animations on this model' : 'None — model only'}
          </option>
          {animations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
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
