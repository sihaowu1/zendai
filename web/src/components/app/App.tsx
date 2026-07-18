import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useSceneProject } from '../../state/useSceneProject';
import { StatusBar } from './StatusBar';
import { Logo } from './Logo';
import { ModelGenerationScreen } from '../screens/ModelGenerationScreen';
import { VideoGenerationScreen } from '../screens/VideoGenerationScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { ChatPanel } from '../ChatPanel';
import { useAuth } from '../../auth/useAuth';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { MarketplaceDetailScreen } from '../screens/MarketplaceDetailScreen';

/**
 * Studio router shell (mounted under `/*` from `main.tsx`).
 *
 * The marketing landing lives at `/` (`web/src/landing/Home.jsx`). This shell owns
 * `/model`, `/video`, and `/export`. `useSceneProject` lives here so both
 * screens share one state instance — per SPEC.md Issue 4.
 *
 * Auth is optional: studio routes stay public. Sign-in unlocks GitHub-linked
 * features; logout returns to the public landing page.
 */
export function App() {
  const project = useSceneProject();

  return (
    <div className="flex h-full flex-col">
      <TopNav />
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route path="/model" element={<ModelGenerationScreen project={project} />} />
          <Route
            path="/video"
            element={
              <VideoGenerationScreen
                models={project.models}
                tunables={project.tunables}
                onParamChange={project.setParam}
                mp4Job={project.mp4Job}
                timelineClips={project.timelineClips}
                timelineTotal={project.timelineTotal}
                playback={project.playback}
                previewCode={project.previewCode}
                previewTime={project.previewTime}
                previewModelName={project.previewModelName}
                onDropModel={project.addClipAtSecond}
                chat={
                  <ChatPanel
                    busy={project.busy}
                    status={project.status}
                    onGenerate={project.generate}
                    onModify={project.modify}
                  />
                }
              />
            }
          />
          <Route
            path="/export"
            element={
              <ExportScreen
                code={project.code}
                blenderCode={project.blenderCode}
                modelName={project.models.find((m) => m.id === project.activeModelId)?.name ?? 'Scene'}
                busy={project.busy}
                onExportCode={project.exportCode}
                onExportMp4={project.exportMp4}
                tunables={project.tunables}
                onParamChange={project.setParam}
                mp4Job={project.mp4Job}
                timelineClips={project.timelineClips}
                timelineTotal={project.timelineTotal}
                playback={project.playback}
                previewCode={project.previewCode}
                previewTime={project.previewTime}
                previewModelName={project.previewModelName}
              />
            }
          />
          <Route path="/marketplace" element={<MarketplaceScreen />} />
          <Route path="/marketplace/:id" element={<MarketplaceDetailScreen />} />
          <Route path="*" element={<Navigate to="/model" replace />} />
        </Routes>
      </div>
      <StatusBar busy={project.busy} status={project.status} />
    </div>
  );
}

function TopNav() {
  const { configured, isAuthenticated, isLoading, login, logout, user } = useAuth();

  return (
    <div className="flex flex-shrink-0 items-center gap-5 border-b border-border bg-bg-panel px-4 py-2.5">
      <Link to="/" className="flex items-center gap-2 text-text no-underline hover:opacity-80">
        <Logo size={26} />
        <span className="text-[18px] font-semibold tracking-wide">Zendai</span>
      </Link>
      <nav className="flex gap-1" aria-label="Screens">
        <NavLink to="/model" className={navLinkClassName}>
          Model
        </NavLink>
        <NavLink to="/video" className={navLinkClassName}>
          Video
        </NavLink>
        <NavLink to="/export" className={navLinkClassName}>
          Export
        </NavLink>
        <NavLink to="/marketplace" className={navLinkClassName}>
          Marketplace
        </NavLink>
      </nav>
      <div className="flex-1" />

      {configured && !isLoading && (
        isAuthenticated ? (
          <div className="flex items-center gap-2.5">
            {user?.name && <span className="text-[13px] text-text-dim">{user.name}</span>}
            <button type="button" className="btn btn-secondary" onClick={logout}>
              Log out
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => void login({ screenHint: 'login' })}>
            Log in
          </button>
        )
      )}
    </div>
  );
}

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return `rounded-md px-3 py-1.5 text-[13px] font-medium no-underline transition-colors ${
    isActive ? 'text-text bg-bg-raised' : 'text-text-dim bg-transparent hover:text-text hover:bg-bg-raised/60'
  }`;
}
