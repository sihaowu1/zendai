import { useEffect, useRef } from 'react';
import * as api from '../api/client';
import { useAuth } from '../auth/useAuth';
import { readLinkedGitHubRepo } from './useGitHubRepo';

/**
 * On studio start: if a GitHub repo is linked and the user is signed in, pull
 * `models/` into local state. Unlinked sessions keep the in-memory Default seed
 * (reset happens explicitly on unlink).
 */
export function useGitHubStartupSync(options: {
  replaceFromRemote: (
    models: Array<{ id: string; name: string; code: string; blenderCode?: string }>,
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

    if (!configured || !isAuthenticated) {
      // Keep waiting while Auth0 loads; once settled without a session, stop.
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
