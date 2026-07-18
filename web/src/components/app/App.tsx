import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useSceneProject } from '../../state/useSceneProject';
import { Logo } from './Logo';
import { ModelGenerationScreen } from '../screens/ModelGenerationScreen';
import { VideoGenerationScreen } from '../screens/VideoGenerationScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { ChatPanel } from '../ChatPanel';
import { useAuth } from '../../auth/useAuth';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { MarketplaceDetailScreen } from '../screens/MarketplaceDetailScreen';
import { Button } from '../ui/Button';
import { useGitHubStartupSync } from '../useGitHubStartupSync';

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
  useGitHubStartupSync({ replaceFromRemote: project.replaceFromRemote });

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
                aspectRatio={project.aspectRatio}
                onAspectRatioChange={project.setAspectRatio}
                tunables={project.tunables}
                onParamChange={project.setParam}
                mp4Job={project.mp4Job}
                timelineClips={project.timelineClips}
                timelineLanes={project.timelineLanes}
                collapsedLaneIds={project.collapsedLanes}
                onToggleLane={project.toggleLaneCollapsed}
                timelineFocusModelId={project.timelineFocusModelId}
                onTimelineFocusModelChange={project.setTimelineFocusModelId}
                timelineTotal={project.timelineTotal}
                playback={project.playback}
                previewCode={project.previewCode}
                previewScenes={project.previewScenes}
                previewTime={project.previewTime}
                previewTrackOverlays={project.previewTrackOverlays}
                previewModelName={project.previewModelName}
                onDropModel={project.addClipAtSecond}
                activeModelId={project.activeModelId}
                onSelectModel={project.setActiveModel}
                onDeleteClip={project.deleteClip}
                onCopyClip={project.copyClip}
                onPasteClip={project.pasteClip}
                hasClipboardClip={project.hasClipboardClip}
                onResizeClip={project.resizeClip}
                onMoveClip={project.moveClip}
                userCamera={project.userCamera}
                onUserCameraChange={project.setUserCamera}
                chat={
                  <ChatPanel
                    busy={project.busy}
                    status={project.status}
                    onGenerate={project.animate}
                    title="Video chat"
                    showModify={false}
                    allowImageAttachment={false}
                    generateLabel="Animate"
                    placeholder="Describe motion for the selected model…"
                    emptyHint="Select a model or merge in Materials — Animate always targets that selection. Orbit the preview to frame the shot."
                  />
                }
              />
            }
          />
          <Route
            path="/export"
            element={
              <ExportScreen
                models={project.models}
                code={project.code}
                modelName={project.models.find((m) => m.id === project.activeModelId)?.name ?? 'Model'}
                busy={project.busy}
                onExportCode={project.exportCode}
                onExportModel={project.exportModel}
                onExportMp4={project.exportMp4}
                tunables={project.tunables}
                onParamChange={project.setParam}
                mp4Job={project.mp4Job}
                timelineClips={project.timelineClips}
                timelineLanes={project.timelineLanes}
                collapsedLaneIds={project.collapsedLanes}
                onToggleLane={project.toggleLaneCollapsed}
                timelineTotal={project.timelineTotal}
                playback={project.playback}
                previewCode={project.previewCode}
                previewScenes={project.previewScenes}
                previewTime={project.previewTime}
                previewTrackOverlays={project.previewTrackOverlays}
                previewModelName={project.previewModelName}
                userCamera={project.userCamera}
                onUserCameraChange={project.setUserCamera}
                onGitHubUnlink={project.resetToDefault}
                onGitHubPull={project.replaceFromRemote}
              />
            }
          />
          <Route path="/marketplace" element={<MarketplaceScreen />} />
          <Route path="/marketplace/:id" element={<MarketplaceDetailScreen />} />
          <Route path="*" element={<Navigate to="/model" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function TopNav() {
  const { configured, isAuthenticated, isLoading, login, logout, user } = useAuth();

  return (
    <div className="flex flex-shrink-0 items-center gap-5 border-b border-border bg-bg-panel px-4 py-2.5">
      <Link to="/" className="flex items-center gap-2 text-text no-underline hover:opacity-80">
        <Logo size={120} />
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
            {user?.name && <span className="text-[14px] text-text-dim">{user.name}</span>}
            <Button variant="secondary" type="button" onClick={logout}>
              Log out
            </Button>
          </div>
        ) : (
          <Button variant="secondary" type="button" onClick={() => void login({ screenHint: 'login' })}>
            Log in
          </Button>
        )
      )}
    </div>
  );
}

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return `rounded-md px-3 py-1.5 text-[14px] font-medium no-underline transition-colors ${
    isActive ? 'text-text bg-bg-raised' : 'text-text-dim bg-transparent hover:text-text hover:bg-bg-raised/60'
  }`;
}
