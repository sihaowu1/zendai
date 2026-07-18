import { Octokit } from '@octokit/rest';
import type { ProjectFile } from './codeExport';
import { parseModelFolder, type GitHubModelInput } from './githubProjectFiles';

export interface LinkedRepo {
  owner: string;
  repo: string;
  url: string;
  defaultBranch: string;
}

export interface CommitResult {
  commitUrl: string;
  sha: string;
}

/**
 * Create a new repo under the authenticated GitHub user and push an initial
 * multi-file commit (same file set as the ZIP export).
 *
 * Uses `auto_init: true` because GitHub's Git Data API (blobs/trees) returns
 * 409 "Git Repository is empty" until the repo has at least one commit.
 */
export async function createRepoAndCommit(options: {
  token: string;
  name: string;
  private?: boolean;
  files: ProjectFile[];
  message?: string;
  description?: string;
}): Promise<LinkedRepo & CommitResult> {
  const octokit = new Octokit({ auth: options.token });
  const name = options.name.trim();
  if (!name) throw new Error('Repository name is required');

  const { data: created } = await octokit.repos.createForAuthenticatedUser({
    name,
    private: Boolean(options.private),
    description: options.description ?? 'Exported from MotionForge',
    auto_init: true,
  });

  const owner = created.owner.login;
  const repo = created.name;
  const defaultBranch = created.default_branch || 'main';

  await waitForBranch(octokit, owner, repo, defaultBranch);

  const commit = await commitFiles({
    token: options.token,
    owner,
    repo,
    branch: defaultBranch,
    files: options.files,
    message: options.message?.trim() || 'Initial MotionForge export',
  });

  return {
    owner,
    repo,
    url: created.html_url,
    defaultBranch,
    commitUrl: commit.commitUrl,
    sha: commit.sha,
  };
}

/**
 * Verify the authenticated user can push to an existing repo.
 */
export async function verifyRepoAccess(options: {
  token: string;
  owner: string;
  repo: string;
}): Promise<LinkedRepo> {
  const octokit = new Octokit({ auth: options.token });
  const { data } = await octokit.repos.get({
    owner: options.owner,
    repo: options.repo,
  });

  if (!data.permissions?.push) {
    throw new Error(`No push access to ${options.owner}/${options.repo}`);
  }

  return {
    owner: data.owner.login,
    repo: data.name,
    url: data.html_url,
    defaultBranch: data.default_branch || 'main',
  };
}

/**
 * Atomic multi-file commit via the Git Data API (blobs → tree → commit → ref).
 * Empty repos are bootstrapped first via the Contents API (Git Data API requires
 * at least one existing commit).
 */
export async function commitFiles(options: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  files: ProjectFile[];
  message?: string;
}): Promise<CommitResult> {
  const octokit = new Octokit({ auth: options.token });
  const { owner, repo } = options;

  let branch = options.branch;
  if (!branch) {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    branch = repoData.default_branch || 'main';
  }

  await ensureRepoInitialized(octokit, owner, repo, branch);

  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const parentSha = ref.object.sha;

  const treeItems = await Promise.all(
    options.files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        encoding: 'base64',
      });
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    }),
  );

  // New tree without base_tree so the commit contains exactly our export files
  // (drops auto_init README / bootstrap placeholder).
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
  });

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: options.message?.trim() || 'Update MotionForge scene',
    tree: tree.sha,
    parents: [parentSha],
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
  });

  return {
    commitUrl: commit.html_url,
    sha: commit.sha,
  };
}

/** Parse `owner/repo` or separate fields into normalized parts. */
export function parseOwnerRepo(
  ownerOrFull: string,
  repoMaybe?: string,
): { owner: string; repo: string } {
  const full = repoMaybe?.trim()
    ? `${ownerOrFull.trim()}/${repoMaybe.trim()}`
    : ownerOrFull.trim();
  const match = full.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new Error('Repository must be in owner/repo format');
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Pull scene modules from `models/<slug>/` in a linked repo.
 * Missing `models/` returns an empty list. Animations are ignored for now.
 */
export async function pullModelsFromRepo(options: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}): Promise<{ models: GitHubModelInput[] }> {
  const octokit = new Octokit({ auth: options.token });
  const { owner, repo } = options;

  let branch = options.branch;
  if (!branch) {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    branch = repoData.default_branch || 'main';
  }

  let tree;
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: 'true',
    });
    tree = data.tree;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return { models: [] };
    throw err;
  }

  const modulePaths = tree
    .filter((entry) => entry.type === 'blob' && entry.path)
    .map((entry) => entry.path as string)
    .filter((path) => /^models\/[^/]+\/scene\.module\.js$/.test(path));

  const models: GitHubModelInput[] = [];

  for (const modulePath of modulePaths) {
    const folder = modulePath.split('/')[1];
    if (!folder) continue;
    const { id, name } = parseModelFolder(folder);
    const code = await fetchFileContent(octokit, owner, repo, modulePath, branch);
    if (!code.trim()) continue;

    models.push({ id, name, code });
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  return { models };
}

async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string> {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  if (Array.isArray(data) || data.type !== 'file' || !('content' in data) || !data.content) {
    throw new Error(`Expected file at ${path}`);
  }
  return Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
}

async function waitForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  attempts = 10,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
      return;
    } catch {
      await sleep(300 * (i + 1));
    }
  }
  throw new Error(`Timed out waiting for ${owner}/${repo} branch ${branch} after auto_init`);
}

/**
 * Git Data API refuses empty repos (409). Seed one commit via Contents API when needed.
 */
async function ensureRepoInitialized(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  try {
    await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return;
  } catch {
    // fall through — empty or branch missing
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: '.motionforge-init',
    message: 'Initialize repository for MotionForge export',
    content: Buffer.from('# MotionForge\n', 'utf8').toString('base64'),
    branch,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
