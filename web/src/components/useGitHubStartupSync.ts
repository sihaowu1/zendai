import { useEffect, useRef } from 'react';
import * as api from '../api/client';
import { useAuth } from '../auth/useAuth';
import { readLinkedGitHubRepo } from './useGitHubRepo';

const MODELS_STORAGE_KEY = 'motionforge:models';

/**
 * On studio start: if a GitHub repo is linked, the user is signed in, AND
 * there is no persisted local state, pull `models/` into local state.
 *
 * If localStorage already has models (including after deletions), skip the
 * pull — local state is the source of truth. The user can always do an
 * explicit "Pull from GitHub" to re-sync.
 */
export function useGitHubStartupSync(options: {
  replaceFromRemote: (
    models: Array<{ id: string; name: string; code: string }>,
  ) => void;
}): void {
  const { isAuthenticated, isLoading, configured } = useAuth();
  const didRun = useRef(false);
  const replaceRef = useRef(options.replaceFromRemote);
  replaceRef.current = options.replaceFromRemote;

  useEffect(() => {
    if (didRun.current) return;
    if (configured && isLoading) return;

    const linked = readLinkedGitHubRepo();
    if (!linked) {
      didRun.current = true;
      return;
    }

    // If localStorage already has persisted models, respect that state
    // (it reflects user deletions, edits, etc.). Only auto-pull from
    // GitHub on a truly fresh session with no local data.
    const hasLocalState = (() => {
      try {
        const raw = localStorage.getItem(MODELS_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch { return false; }
    })();

    if (hasLocalState) {
      didRun.current = true;
      return;
    }

    if (!configured || !isAuthenticated) {
      if (!isLoading) didRun.current = true;
      return;
    }

    didRun.current = true;
    void (async () => {
      try {
        const result = await api.githubPull({
          owner: linked.owner,
          repo: linked.repo,
          branch: linked.defaultBranch,
        });
        replaceRef.current(result.models);
      } catch {
        // Leave seeded Default; Export panel surfaces errors on manual actions.
      }
    })();
  }, [configured, isAuthenticated, isLoading]);
}
