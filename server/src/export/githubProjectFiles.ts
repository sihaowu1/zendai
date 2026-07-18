import { slugify } from '../utils/fsx';
import { packModelFiles, type CodeExportFormat, type ProjectFile } from './codeExport';
import { reactPackageJson } from './exportTemplates';

export interface GitHubModelInput {
  id: string;
  name: string;
  code: string;
}

/**
 * Multi-model GitHub layout (format wrappers per model folder):
 *
 *   models/<slug>/scene.module.js
 *   models/<slug>/…format files…
 *   animations/.gitkeep
 *   package.json                     (react only, repo root)
 *   README.md
 *
 * Slug = sanitized name + model id so paths stay unique and round-trip on pull.
 */
export function buildGitHubProjectFiles(options: {
  models: GitHubModelInput[];
  title?: string;
  format?: CodeExportFormat;
}): ProjectFile[] {
  const models = options.models.filter((m) => m.code.trim());
  if (models.length === 0) {
    throw new Error('At least one model with code is required');
  }

  const title = options.title?.trim() || 'Zendai project';
  const format = options.format ?? 'standalone';
  const files: ProjectFile[] = [];

  for (const model of models) {
    const slug = modelFolderSlug(model.name, model.id);
    const packed = packModelFiles({
      code: model.code,
      format,
      title: model.name,
    });
    for (const file of packed) {
      files.push({ path: `models/${slug}/${file.path}`, content: file.content });
    }
  }

  files.push({ path: 'animations/.gitkeep', content: '' });
  if (format === 'react') {
    files.push({ path: 'package.json', content: reactPackageJson() });
  }
  files.push({ path: 'README.md', content: githubProjectReadme(title, models, format) });
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

function formatLabel(format: CodeExportFormat): string {
  if (format === 'react') return 'React component';
  if (format === 'module') return 'ES module only';
  return 'Standalone HTML';
}

function githubProjectReadme(
  title: string,
  models: GitHubModelInput[],
  format: CodeExportFormat,
): string {
  const list = models
    .map((m) => {
      const slug = modelFolderSlug(m.name, m.id);
      return `- \`models/${slug}/\` — ${m.name}`;
    })
    .join('\n');

  const formatExtra =
    format === 'standalone'
      ? 'Each model folder includes `index.html` + `viewer.js`. Serve a folder over HTTP (`npx serve models/<slug>`).'
      : format === 'react'
        ? 'Each model folder includes `SceneCanvas.tsx`. Install peers from the root `package.json` (`three`, `react`, `react-dom`).'
        : 'Each model folder is a raw `scene.module.js`. Hosts inject `THREE`; modules must not `import`/`require`/`fetch`.';

  return `# ${title}

Exported from Zendai — code-based 3D models, fully editable.

## Format: ${formatLabel(format)}

${formatExtra}

## Layout

- \`models/\` — one folder per model (\`scene.module.js\` plus format wrappers)
- \`animations/\` — reserved for animation scripts (empty for now)

## Models

${list}

## Scene module contract

Each \`scene.module.js\` exports \`PARAMS\`, optional \`CAMERA\`, \`buildScene\`, and
\`updateScene\`.

## Tweak it

Edit any value in \`PARAMS\` and reload — the code is the project.
`;
}
