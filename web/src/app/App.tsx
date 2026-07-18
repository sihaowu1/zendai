import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useSceneProject } from '../state/useSceneProject';
import { StatusBar } from './StatusBar';
import { ModelGenerationScreen } from '../screens/ModelGenerationScreen';
import { VideoGenerationScreen } from '../screens/VideoGenerationScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { ChatPanel } from '../chat/ChatPanel';
import { useAuth } from '../auth/useAuth';

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
    <div className="app">
      <TopNav />
      <div style={styles.outlet}>
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
    <nav style={styles.nav} aria-label="Screens">
      <NavLink to="/" style={navLinkStyle} end>
        Home
      </NavLink>
      <NavLink to="/model" style={navLinkStyle}>
        Model
      </NavLink>
      <NavLink to="/video" style={navLinkStyle}>
        Video
      </NavLink>
      <NavLink to="/export" style={navLinkStyle}>
        Export
      </NavLink>

      <div style={styles.navSpacer} />

      {configured && !isLoading && (
        isAuthenticated ? (
          <>
            {user?.name && <span style={styles.navUser}>{user.name}</span>}
            <button type="button" style={styles.navBtn} onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <button type="button" style={styles.navBtn} onClick={() => void login({ screenHint: 'login' })}>
            Log in
          </button>
        )
      )}
    </nav>
  );
}

function navLinkStyle({ isActive }: { isActive: boolean }): CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    color: isActive ? 'var(--text)' : 'var(--text-dim)',
    background: isActive ? 'var(--bg-raised)' : 'transparent',
    border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
  };
}

const styles = {
  nav: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    padding: '6px 14px',
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  navSpacer: {
    flex: 1,
  },
  navUser: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginRight: 4,
  },
  navBtn: {
    padding: '6px 12px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text)',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
  },
  outlet: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
} satisfies Record<string, CSSProperties>;
