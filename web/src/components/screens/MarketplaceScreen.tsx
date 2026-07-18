import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketplaceItemSummary } from '@motionforge/shared';
import { getMarketplace, updateMarketplaceItem, deleteMarketplaceItem } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { Viewport } from '../../viewport/Viewport';
import { Button } from '../ui/Button';

type Tab = 'all' | 'mine';

export function MarketplaceScreen() {
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState<MarketplaceItemSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  // Edit modal state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMarketplace(page, 20, tab === 'mine')
      .then((res) => {
        setItems(res.items);
        setPages(res.pages);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [page, tab]);

  const isOwned = useCallback(
    (item: MarketplaceItemSummary) => isAuthenticated && user?.sub && item.creatorSub === user.sub,
    [isAuthenticated, user],
  );

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this item? This cannot be undone.')) return;
    try {
      await deleteMarketplaceItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const openEdit = useCallback((e: React.MouseEvent, item: MarketplaceItemSummary) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.description);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditBusy(true);
    try {
      const updated = await updateMarketplaceItem(editingId, { title: editTitle, description: editDesc });
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, title: updated.title, description: updated.description } : i)));
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditBusy(false);
    }
  }, [editingId, editTitle, editDesc]);

  return (
    <main className="mx-auto w-full max-w-[1200px] overflow-y-auto p-6">
      <h1 className="mb-4 text-2xl font-bold text-text">Marketplace</h1>

      {/* Tabs */}
      {isAuthenticated && (
        <div className="mb-4 flex gap-1">
          <button
            type="button"
            onClick={() => { setTab('all'); setPage(1); }}
            className={`cursor-pointer rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === 'all'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-transparent text-text-dim hover:bg-bg-raised'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => { setTab('mine'); setPage(1); }}
            className={`cursor-pointer rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === 'mine'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-transparent text-text-dim hover:bg-bg-raised'
            }`}
          >
            My Items
          </button>
        </div>
      )}

      {error && <p className="mb-3 text-[14px] text-red-400">{error}</p>}
      {loading ? (
        <p className="text-[14px] text-text-dim">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-text-dim">
          {tab === 'mine' ? 'You haven\u2019t published any scenes yet.' : 'No published scenes yet. Be the first!'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/marketplace/${item.id}`}
                className="relative flex flex-col gap-2 rounded-lg border border-border bg-bg-panel p-4 text-inherit no-underline transition-colors hover:border-border-strong hover:bg-bg-raised"
              >
                {/* Owner actions */}
                {isOwned(item) && (
                  <div className="absolute right-2 top-2 z-10 flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => openEdit(e, item)}
                      title="Edit"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-black/40 text-text-dim backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-text"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item.id)}
                      title="Delete"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-black/40 text-text-dim backdrop-blur-sm transition-colors hover:bg-red-900/60 hover:text-red-400"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                )}
                {/* Live 3D preview */}
                <div className="pointer-events-none h-[160px] w-full overflow-hidden rounded-md bg-black">
                  <Viewport code={item.code} interactive={false} />
                </div>
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

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingId(null)}>
          <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-0 text-[16px] font-semibold text-text">Edit Item</h3>
            <label className="flex flex-col gap-1 text-[13px] text-text-dim">
              Title
              <input
                className="rounded-md border border-border bg-bg-raised px-3 py-1.5 text-[14px] text-text outline-none focus:border-accent"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-text-dim">
              Description
              <textarea
                className="min-h-[80px] rounded-md border border-border bg-bg-raised px-3 py-1.5 text-[14px] text-text outline-none focus:border-accent"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={1000}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button variant="primary" type="button" disabled={editBusy} onClick={saveEdit}>
                {editBusy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
