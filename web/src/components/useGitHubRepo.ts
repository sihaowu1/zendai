import { useCallback, useState } from 'react';
import * as api from '../api/client';
import type { GitHubLinkedRepo } from '../api/client';

const STORAGE_KEY = 'motionforge:github-repo';

function readStoredRepo(): GitHubLinkedRepo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GitHubLinkedRepo;
    if (!parsed?.owner || !parsed?.repo || !parsed?.url) return null;
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      url: parsed.url,
      defaultBranch: parsed.defaultBranch || 'main',
    };
  } catch {
    return null;
  }
}

function writeStoredRepo(repo: GitHubLinkedRepo | null): void {
  if (!repo) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
}

export type GitHubLinkMode = 'create' | 'existing';

/**
 * Client-side linked GitHub repo (localStorage) + create / link / commit actions.
 */
export function useGitHubRepo() {
  const [linked, setLinked] = useState<GitHubLinkedRepo | null>(() => readStoredRepo());
  const [mode, setMode] = useState<GitHubLinkMode>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(null);

  const persist = useCallback((repo: GitHubLinkedRepo | null) => {
    writeStoredRepo(repo);
    setLinked(repo);
  }, []);

  const createRepo = useCallback(
    async (opts: {
      name: string;
      privateRepo: boolean;
      code: string;
      blenderCode: string;
      title?: string;
      message?: string;
    }) => {
      setBusy(true);
      setError(null);
      try {
        const result = await api.githubCreateRepo({
          name: opts.name,
          private: opts.privateRepo,
          code: opts.code,
          blenderCode: opts.blenderCode,
          title: opts.title,
          message: opts.message,
        });
        const repo: GitHubLinkedRepo = {
          owner: result.owner,
          repo: result.repo,
          url: result.url,
          defaultBranch: result.defaultBranch,
        };
        persist(repo);
        setLastCommitUrl(result.commitUrl);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [persist],
  );

  const linkRepo = useCallback(
    async (fullName: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await api.githubLinkRepo(fullName.trim());
        persist(result);
        setLastCommitUrl(null);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [persist],
  );

  const commit = useCallback(
    async (opts: {
      code: string;
      blenderCode: string;
      title?: string;
      message?: string;
    }) => {
      if (!linked) throw new Error('No repository linked');
      setBusy(true);
      setError(null);
      try {
        const result = await api.githubCommit({
          owner: linked.owner,
          repo: linked.repo,
          branch: linked.defaultBranch,
          code: opts.code,
          blenderCode: opts.blenderCode,
          title: opts.title,
          message: opts.message,
        });
        setLastCommitUrl(result.commitUrl);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [linked],
  );

  const unlink = useCallback(() => {
    persist(null);
    setLastCommitUrl(null);
    setError(null);
  }, [persist]);

  return {
    linked,
    mode,
    setMode,
    busy,
    error,
    lastCommitUrl,
    createRepo,
    linkRepo,
    commit,
    unlink,
  };
}
