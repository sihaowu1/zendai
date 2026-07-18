import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { MarketplaceItemDetail } from '@motionforge/shared';
import { getMarketplaceItem } from '../api/client';
import { Viewport } from '../viewport/Viewport';

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

  if (loading) return <main style={styles.container}><p className="hint">Loading…</p></main>;
  if (error) return <main style={styles.container}><p style={{ color: 'var(--error, #f66)' }}>{error}</p></main>;
  if (!item) return <main style={styles.container}><p className="hint">Not found.</p></main>;

  return (
    <main style={styles.container}>
      <div style={styles.top}>
        <div style={styles.info}>
          <h1 style={styles.title}>{item.title}</h1>
          <p style={styles.desc}>{item.description}</p>
          <div style={styles.meta}>
            {item.creator.picture && <img src={item.creator.picture} alt="" style={styles.avatar} />}
            <span>{item.creator.name}</span>
            <span style={styles.date}>{new Date(item.publishedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={styles.viewport}>
          <Viewport code={item.code} />
        </div>
      </div>
      <div style={styles.codeSection}>
        <div style={styles.tabs}>
          <button
            type="button"
            style={tab === 'threejs' ? styles.tabActive : styles.tab}
            onClick={() => setTab('threejs')}
          >
            Three.js
          </button>
          {item.blenderCode && (
            <button
              type="button"
              style={tab === 'blender' ? styles.tabActive : styles.tab}
              onClick={() => setTab('blender')}
            >
              Blender
            </button>
          )}
        </div>
        <pre style={styles.code}>{tab === 'threejs' ? item.code : item.blenderCode}</pre>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1200, margin: '0 auto', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20 },
  top: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 300 },
  info: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 },
  desc: { fontSize: 14, color: 'var(--text-dim)', margin: 0 },
  meta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', marginTop: 'auto' },
  avatar: { width: 24, height: 24, borderRadius: '50%' },
  date: { marginLeft: 'auto' },
  viewport: { borderRadius: 8, overflow: 'hidden', background: '#000', minHeight: 280 },
  codeSection: { display: 'flex', flexDirection: 'column', gap: 0 },
  tabs: { display: 'flex', gap: 0 },
  tab: { padding: '8px 16px', fontSize: 13, background: 'var(--bg-panel)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-dim)' },
  tabActive: { padding: '8px 16px', fontSize: 13, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderBottom: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600 },
  code: { margin: 0, padding: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '0 0 8px 8px', overflow: 'auto', maxHeight: 400, fontSize: 12, lineHeight: 1.5 },
};
