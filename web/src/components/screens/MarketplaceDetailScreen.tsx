import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { MarketplaceItemDetail } from '@motionforge/shared';
import { getMarketplaceItem } from '../../api/client';
import { Viewport } from '../../viewport/Viewport';
import { exportSceneAs, type ModelFormat } from '../../viewport/exportScene';
import { Button } from '../ui/Button';
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
  const [item, setItem] = useState<MarketplaceItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

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

  const containerClassName = 'mx-auto flex w-full max-w-[1200px] flex-col gap-5 overflow-y-auto p-6';

  if (loading) return <main className={containerClassName}><p className="text-[14px] text-text-dim">Loading…</p></main>;
  if (error && !item) return <main className={containerClassName}><p className="text-[14px] text-red-400">{error}</p></main>;
  if (!item) return <main className={containerClassName}><p className="text-[14px] text-text-dim">Not found.</p></main>;

  return (
    <main className={containerClassName}>
      <div className="grid min-h-[300px] grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left: info + actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-2xl font-bold text-text">{item.title}</h1>
            <p className="m-0 text-[15px] text-text-dim">{item.description}</p>
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

        {/* Right: viewport */}
        <div className="min-h-[280px] overflow-hidden rounded-lg bg-black">
          <Viewport code={item.code} />
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
