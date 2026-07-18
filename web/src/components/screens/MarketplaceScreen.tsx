import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketplaceItemSummary } from '@motionforge/shared';
import { getMarketplace } from '../../api/client';
import { Button } from '../ui/Button';

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
    <main className="mx-auto w-full max-w-[1200px] overflow-y-auto p-6">
      <h1 className="mb-4 text-2xl font-bold text-text">Marketplace</h1>
      {error && <p className="mb-3 text-[14px] text-red-400">{error}</p>}
      {loading ? (
        <p className="text-[14px] text-text-dim">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-text-dim">No published scenes yet. Be the first!</p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/marketplace/${item.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-bg-panel p-4 text-inherit no-underline transition-colors hover:border-border-strong hover:bg-bg-raised"
              >
                <h3 className="m-0 text-[18px] font-semibold text-text">{item.title}</h3>
                <p className="m-0 flex-1 text-[14px] text-text-dim">{item.description || 'No description'}</p>
                <div className="flex items-center gap-2 text-[13px] text-text-dim">
                  {item.creator.picture && (
                    <img src={item.creator.picture} alt="" className="h-5 w-5 rounded-full" />
                  )}
                  <span>{item.creator.name}</span>
                  <span className="ml-auto">{new Date(item.publishedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button variant="secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Prev
              </Button>
              <span className="text-[14px] text-text-dim">
                Page {page} of {pages}
              </span>
              <Button variant="secondary" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
