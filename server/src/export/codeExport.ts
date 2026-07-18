import type { Response } from 'express';
import archiver from 'archiver';
import { slugify } from '../utils/fsx';
import { exportReadme, viewerHtml, viewerJs } from './exportTemplates';

export interface CodeExportOptions {
  code: string;
  blenderCode?: string;
  title?: string;
}

export interface ProjectFile {
  path: string;
  content: string;
}

/**
 * Same file set used by ZIP download and GitHub push — keep them in sync.
 */
export function buildProjectFiles(options: CodeExportOptions): ProjectFile[] {
  const title = options.title?.trim() || 'MotionForge scene';
  const files: ProjectFile[] = [
    { path: 'scene.module.js', content: options.code },
    { path: 'index.html', content: viewerHtml(title) },
    { path: 'viewer.js', content: viewerJs() },
  ];
  if (options.blenderCode?.trim()) {
    files.push({ path: 'scene.blender.py', content: options.blenderCode });
  }
  files.push({ path: 'README.md', content: exportReadme(title) });
  return files;
}

/**
 * Streams a ZIP of the generated project as code: the scene module, a
 * standalone Three.js viewer, the Blender script, and a README.
 */
export function streamProjectZip(res: Response, options: CodeExportOptions): void {
  const title = options.title?.trim() || 'Zendai scene';
  const slug = slugify(title);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);

  for (const file of buildProjectFiles(options)) {
    archive.append(file.content, { name: file.path });
  }
  void archive.finalize();
}
