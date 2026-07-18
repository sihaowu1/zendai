import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { MarketplaceItemDetail } from '@motionforge/shared';
import { getMarketplaceItem, updateMarketplaceItem, deleteMarketplaceItem } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { Viewport } from '../../viewport/Viewport';
import { exportSceneAs, type ModelFormat } from '../../viewport/exportScene';
import { Button, IconButton } from '../ui/Button';
import { PANEL_HEADER } from '../ui/Panel';

/** Build an LLM-ready prompt that bundles the scene code with integration instructions. */
function buildCopyPrompt(item: MarketplaceItemDetail): string {
  return `You are integrating a Zendai 3D scene module into a web project.

## Scene: ${item.title}

${item.description}

## How to use this scene

This is a self-contained Three.js scene module. It does NOT use import/require — the host page must provide the \`THREE\` global (from a <script> tag or import map).

The module exports:
- \`PARAMS\` — an object of tunable values (numbers, booleans, hex color strings). Each has a \`@tunable\` JSDoc annotation with min/max/step metadata.
- \`buildScene({ THREE, scene, params })\` — creates the geometry and adds it to the scene. Returns a named object map of parts.
- \`updateScene({ THREE, scene, objects, params, time })\` — called every frame. Must be pure (no Math.random, no accumulated state).
- \`CAMERA\` (optional) — \`{ position: [x,y,z], lookAt: [x,y,z], fov: number }\`.

## Integration steps

1. Add Three.js to the project (\`npm install three\` or CDN \`<script>\`).
2. Create a canvas element and a Three.js WebGLRenderer, Scene, PerspectiveCamera, and OrbitControls.
3. Load the module (inline or as a separate .js file).
4. Call \`buildScene({ THREE, scene, params: module.PARAMS })\` once.
5. In the render loop, call \`updateScene({ THREE, scene, objects, params: module.PARAMS, time })\` every frame, where \`time\` is seconds since start.
6. To make values adjustable, read the \`@tunable\` annotations from \`PARAMS\` and bind them to UI controls (sliders, color pickers, switches).

## Scene module code

\`\`\`javascript
${item.code}
\`\`\`

## Notes
- The module must stay pure — no side effects, no randomness, no Date calls.
- Remotion can render this to MP4 if you pass deterministic \`time\` values per frame.
- You can export the scene as .glb/.obj/.stl by running buildScene in a headless Three.js context and using GLTFExporter/OBJExporter/STLExporter.
`;
}

export function MarketplaceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [item, setItem] = useState<MarketplaceItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const isOwned = isAuthenticated && user?.sub && item?.creatorSub === user.sub;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMarketplaceItem(id)
      .then(setItem)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const flash = useCallback((label: string) => {
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const copyCode = useCallback(() => {
    if (!item) return;
    navigator.clipboard.writeText(item.code);
    flash('Code');
  }, [item, flash]);

  const copyPrompt = useCallback(() => {
    if (!item) return;
    navigator.clipboard.writeText(buildCopyPrompt(item));
    flash('Prompt');
  }, [item, flash]);

  const handleExportModel = useCallback(async (format: ModelFormat) => {
    if (!item) return;
    setExportBusy(true);
    try {
      await exportSceneAs(item.code, format);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExportBusy(false);
    }
  }, [item]);

  const startEdit = useCallback(() => {
    if (!item) return;
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditing(true);
  }, [item]);

  const saveEdit = useCallback(async () => {
    if (!item || !id) return;
    setEditBusy(true);
    try {
      const updated = await updateMarketplaceItem(id, { title: editTitle, description: editDesc });
      setItem(updated);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditBusy(false);
    }
  }, [id, item, editTitle, editDesc]);

  const handleDelete = useCallback(async () => {
    if (!id || !confirm('Delete this item? This cannot be undone.')) return;
    try {
      await deleteMarketplaceItem(id);
      navigate('/marketplace');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, navigate]);

  const containerClassName = 'mx-auto flex w-full max-w-[1200px] flex-col gap-5 overflow-y-auto p-6';

  if (loading) return <main className={containerClassName}><p className="text-[14px] text-text-dim">Loading…</p></main>;
  if (error && !item) return <main className={containerClassName}><p className="text-[14px] text-red-400">{error}</p></main>;
  if (!item) return <main className={containerClassName}><p className="text-[14px] text-text-dim">Not found.</p></main>;

  // Fullscreen viewport overlay
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex items-center justify-between border-b border-white/10 bg-bg-panel px-4 py-2.5">
          <span className="text-[14px] font-semibold text-text">{item.title}</span>
          <IconButton
            onClick={() => setExpanded(false)}
            title="Close fullscreen"
            aria-label="Close fullscreen"
            className="h-8 w-8"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </IconButton>
        </div>
        <div className="flex-1 min-h-0">
          <Viewport code={item.code} showToolbar />
        </div>
      </div>
    );
  }

  return (
    <main className={containerClassName}>
      <div className="grid min-h-[300px] grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left: info + actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {editing ? (
              <>
                <input
                  className="rounded-md border border-border bg-bg-raised px-3 py-1.5 text-xl font-bold text-text outline-none focus:border-accent"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={120}
                />
                <textarea
                  className="min-h-[60px] rounded-md border border-border bg-bg-raised px-3 py-1.5 text-[15px] text-text outline-none focus:border-accent"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={1000}
                />
                <div className="flex gap-2">
                  <Button variant="primary" type="button" disabled={editBusy} onClick={saveEdit}>
                    {editBusy ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <h1 className="m-0 flex-1 text-2xl font-bold text-text">{item.title}</h1>
                  {isOwned && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={startEdit}
                        title="Edit"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-text-dim transition-colors hover:bg-bg-raised hover:text-text"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        title="Delete"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-text-dim transition-colors hover:bg-red-900/40 hover:text-red-400"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>
                <p className="m-0 text-[15px] text-text-dim">{item.description}</p>
              </>
            )}
            <div className="flex items-center gap-2 text-[13px] text-text-dim">
              {item.creator.picture && <img src={item.creator.picture} alt="" className="h-6 w-6 rounded-full" />}
              <span>{item.creator.name}</span>
              <span className="ml-auto">{new Date(item.publishedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Copy actions */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-panel p-4">
            <h3 className={PANEL_HEADER}>Use this scene</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" type="button" onClick={copyPrompt}>
                {copied === 'Prompt' ? 'Copied!' : 'Copy Prompt'}
              </Button>
              <Button variant="secondary" type="button" onClick={copyCode}>
                {copied === 'Code' ? 'Copied!' : 'Copy Code'}
              </Button>
            </div>
            <p className="m-0 text-[12px] leading-normal text-text-faint">
              Copy Prompt gives your AI assistant (Cursor, Claude Code, Copilot) the full scene code plus integration instructions. Copy Code gives the raw module.
            </p>
          </div>

          {/* 3D model export */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-panel p-4">
            <h3 className={PANEL_HEADER}>Export 3D model</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" disabled={exportBusy} onClick={() => handleExportModel('glb')}>
                .glb
              </Button>
              <Button variant="secondary" type="button" disabled={exportBusy} onClick={() => handleExportModel('obj')}>
                .obj
              </Button>
              <Button variant="secondary" type="button" disabled={exportBusy} onClick={() => handleExportModel('stl')}>
                .stl
              </Button>
            </div>
            <p className="m-0 text-[12px] leading-normal text-text-faint">
              Download as a 3D file for Unity, Blender, CAD, or 3D printing.
            </p>
            {error && <p className="m-0 text-[12px] text-error">{error}</p>}
          </div>
        </div>

        {/* Right: viewport with fullscreen button */}
        <div className="relative min-h-[280px] overflow-hidden rounded-lg bg-black">
          <Viewport code={item.code} />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title="View fullscreen"
            aria-label="View fullscreen"
            className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-1.5 rounded-md border border-white/20 bg-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            Fullscreen
          </button>
        </div>
      </div>

      {/* Code preview */}
      <div className="flex flex-col">
        <div className="border border-border border-b-0 bg-bg-raised px-4 py-2 text-[14px] font-semibold text-text">
          Three.js
        </div>
        <pre className="m-0 max-h-[400px] overflow-auto rounded-b-lg border border-border bg-bg-raised p-4 text-[13px] leading-relaxed">
          {item.code}
        </pre>
      </div>
    </main>
  );
}
