import type { Response } from 'express';
import archiver from 'archiver';
import { slugify } from '../utils/fsx';
import {
  moduleReadme,
  reactPackageJson,
  reactReadme,
  reactSceneCanvasTsx,
  standaloneReadme,
  viewerHtml,
  viewerJs,
} from './exportTemplates';

export const CODE_EXPORT_FORMATS = ['standalone', 'react', 'module'] as const;
export type CodeExportFormat = (typeof CODE_EXPORT_FORMATS)[number];

export function parseCodeExportFormat(value: unknown): CodeExportFormat {
  if (value === undefined || value === null || value === '') {
    return 'standalone';
  }
  const format = String(value);
  if ((CODE_EXPORT_FORMATS as readonly string[]).includes(format)) {
    return format as CodeExportFormat;
  }
  throw new Error(`format must be one of: ${CODE_EXPORT_FORMATS.join(', ')}`);
}

export interface CodeExportOptions {
  code: string;
  title?: string;
  format?: CodeExportFormat;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface PackModelOptions {
  code: string;
  format: CodeExportFormat;
  /** Used for standalone index.html <title>. */
  title?: string;
}

/**
 * Format-specific files for a single model (no README). Callers prefix paths
 * for GitHub (`models/<slug>/…`) and add their own README / package.json.
 */
export function packModelFiles(options: PackModelOptions): ProjectFile[] {
  const title = options.title?.trim() || 'Zendai scene';
  const files: ProjectFile[] = [{ path: 'scene.module.js', content: options.code }];

  if (options.format === 'standalone') {
    files.push(
      { path: 'index.html', content: viewerHtml(title) },
      { path: 'viewer.js', content: viewerJs() },
    );
  } else if (options.format === 'react') {
    files.push({ path: 'SceneCanvas.tsx', content: reactSceneCanvasTsx() });
  }

  return files;
}

function zipReadme(format: CodeExportFormat, title: string): string {
  if (format === 'react') return reactReadme(title);
  if (format === 'module') return moduleReadme(title);
  return standaloneReadme(title);
}

/**
 * ZIP / single-model project: packed model files + format README
 * (+ root package.json for react).
 */
export function buildProjectFiles(options: CodeExportOptions): ProjectFile[] {
  const title = options.title?.trim() || 'Zendai scene';
  const format = options.format ?? 'standalone';
  const files = packModelFiles({
    code: options.code,
    format,
    title,
  });
  if (format === 'react') {
    files.push({ path: 'package.json', content: reactPackageJson() });
  }
  files.push({ path: 'README.md', content: zipReadme(format, title) });
  return files;
}

/**
 * Streams a ZIP of the generated project as code for the selected format.
 */
export function streamProjectZip(res: Response, options: CodeExportOptions): void {
  const title = options.title?.trim() || 'Zendai scene';
  const format = options.format ?? 'standalone';
  const slug = `${slugify(title)}-${format}`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);

  for (const file of buildProjectFiles({ ...options, format })) {
    archive.append(file.content, { name: file.path });
  }
  void archive.finalize();
}
