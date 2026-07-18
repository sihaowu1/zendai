import { slugify } from '../utils/fsx';
import type { ProjectFile } from './codeExport';

export interface GitHubModelInput {
  id: string;
  name: string;
  code: string;
  blenderCode?: string;
}

/**
 * Multi-model GitHub layout:
 *
 *   models/<slug>/scene.module.js
 *   models/<slug>/scene.blender.py   (optional)
 *   animations/.gitkeep
 *   README.md
 *
 * Slug = sanitized name + model id so paths stay unique and round-trip on pull.
 */
export function buildGitHubProjectFiles(options: {
  models: GitHubModelInput[];
  title?: string;
}): ProjectFile[] {
  const models = options.models.filter((m) => m.code.trim());
  if (models.length === 0) {
    throw new Error('At least one model with code is required');
  }

  const title = options.title?.trim() || 'Zendai project';
  const files: ProjectFile[] = [];

  for (const model of models) {
    const slug = modelFolderSlug(model.name, model.id);
    files.push({
      path: `models/${slug}/scene.module.js`,
      content: model.code,
    });
    if (model.blenderCode?.trim()) {
      files.push({
        path: `models/${slug}/scene.blender.py`,
        content: model.blenderCode,
      });
    }
  }

  files.push({ path: 'animations/.gitkeep', content: '' });
  files.push({ path: 'README.md', content: githubProjectReadme(title, models) });
  return files;
}

export function modelFolderSlug(name: string, id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'model';
  return `${slugify(name)}-${safeId}`;
}

/** Inverse of `modelFolderSlug` for pull — id is the last `-` segment. */
export function parseModelFolder(folder: string): { id: string; name: string } {
  const idx = folder.lastIndexOf('-');
  if (idx <= 0) return { id: folder, name: folder.replace(/-/g, ' ') };
  return {
    id: folder.slice(idx + 1),
    name: folder.slice(0, idx).replace(/-/g, ' '),
  };
}

function githubProjectReadme(title: string, models: GitHubModelInput[]): string {
  const list = models
    .map((m) => {
      const slug = modelFolderSlug(m.name, m.id);
      return `- \`models/${slug}/\` — ${m.name}`;
    })
    .join('\n');

  return `# ${title}

Exported from Zendai — code-based 3D models, fully editable.

## Layout

- \`models/\` — one folder per model (\`scene.module.js\`, optional \`scene.blender.py\`)
- \`animations/\` — reserved for animation scripts (empty for now)

## Models

${list}

## Scene module contract

Each \`scene.module.js\` exports \`PARAMS\`, optional \`CAMERA\`, \`buildScene\`, and
\`updateScene\`. Hosts inject \`THREE\`; modules must not \`import\`/\`require\`/\`fetch\`.

## Tweak it

Edit any value in \`PARAMS\` and reload — the code is the project.
`;
}
