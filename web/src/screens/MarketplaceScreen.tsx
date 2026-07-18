import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketplaceItemSummary } from '@motionforge/shared';
import { getMarketplace } from '../api/client';

export function MarketplaceScreen() {
  const [items, setItems] = useState<MarketplaceItemSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getMarketplace(page)
      .then((res) => {
        setItems(res.items);
        setPages(res.pages);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <main style={styles.container}>
      <h1 style={styles.heading}>Marketplace</h1>
      {error && <p style={styles.error}>{error}</p>}
      {loading ? (
        <p className="hint">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hint">No published scenes yet. Be the first!</p>
      ) : (
        <>
          <div style={styles.grid}>
            {items.map((item) => (
              <Link key={item.id} to={`/marketplace/${item.id}`} style={styles.card}>
                <h3 style={styles.cardTitle}>{item.title}</h3>
                <p style={styles.cardDesc}>{item.description || 'No description'}</p>
                <div style={styles.cardMeta}>
                  {item.creator.picture && (
                    <img src={item.creator.picture} alt="" style={styles.avatar} />
                  )}
                  <span>{item.creator.name}</span>
                  <span style={styles.date}>{new Date(item.publishedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
          {pages > 1 && (
            <div style={styles.pagination}>
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Prev
              </button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, maxWidth: 1200, margin: '0 auto', overflow: 'auto' },
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 16, color: 'var(--text)' },
  error: { color: 'var(--error, #f66)', marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 },
  cardDesc: { fontSize: 13, color: 'var(--text-dim)', margin: 0, flex: 1 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' },
  avatar: { width: 20, height: 20, borderRadius: '50%' },
  date: { marginLeft: 'auto' },
  pagination: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, justifyContent: 'center' },
};
