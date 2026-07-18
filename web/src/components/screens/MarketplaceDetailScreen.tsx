import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { MarketplaceItemDetail } from '@motionforge/shared';
import { getMarketplaceItem } from '../../api/client';
import { Viewport } from '../../viewport/Viewport';

export function MarketplaceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<MarketplaceItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'threejs' | 'blender'>('threejs');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMarketplaceItem(id)
      .then(setItem)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const containerClassName = 'mx-auto flex w-full max-w-[1200px] flex-col gap-5 overflow-y-auto p-6';

  if (loading) return <main className={containerClassName}><p className="text-[14px] text-text-dim">Loading…</p></main>;
  if (error) return <main className={containerClassName}><p className="text-[14px] text-red-400">{error}</p></main>;
  if (!item) return <main className={containerClassName}><p className="text-[14px] text-text-dim">Not found.</p></main>;

  return (
    <main className={containerClassName}>
      <div className="grid min-h-[300px] grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-bold text-text">{item.title}</h1>
          <p className="m-0 text-[15px] text-text-dim">{item.description}</p>
          <div className="mt-auto flex items-center gap-2 text-[13px] text-text-dim">
            {item.creator.picture && <img src={item.creator.picture} alt="" className="h-6 w-6 rounded-full" />}
            <span>{item.creator.name}</span>
            <span className="ml-auto">{new Date(item.publishedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="min-h-[280px] overflow-hidden rounded-lg bg-black">
          <Viewport code={item.code} />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex gap-0">
          <button
            type="button"
            className={
              tab === 'threejs'
                ? 'border border-border bg-bg-raised px-4 py-2 text-[14px] font-semibold text-text'
                : 'border border-border bg-bg-panel px-4 py-2 text-[14px] text-text-dim'
            }
            onClick={() => setTab('threejs')}
          >
            Three.js
          </button>
          {item.blenderCode && (
            <button
              type="button"
              className={
                tab === 'blender'
                  ? 'border border-border border-b-0 bg-bg-raised px-4 py-2 text-[14px] font-semibold text-text'
                  : 'border border-border bg-bg-panel px-4 py-2 text-[14px] text-text-dim'
              }
              onClick={() => setTab('blender')}
            >
              Blender
            </button>
          )}
        </div>
        <pre className="m-0 max-h-[400px] overflow-auto rounded-b-lg border border-border bg-bg-raised p-4 text-[13px] leading-relaxed">
          {tab === 'threejs' ? item.code : item.blenderCode}
        </pre>
      </div>
    </main>
  );
}
