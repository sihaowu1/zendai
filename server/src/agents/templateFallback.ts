import { buildThreeSceneCode } from '@motionforge/shared';

/**
 * Deterministic offline generator used when no OPENROUTER_API_KEY is set.
 * It maps prompt keywords onto the shared parametric multi-part figure
 * template so the whole pipeline (editor → controls → Remotion)
 * stays runnable without network access.
 */

interface ColorRule {
  match: RegExp;
  hex: string;
}

const COLORS: ColorRule[] = [
  { match: /\bred|crimson\b/i, hex: '#e5484d' },
  { match: /\bgreen|emerald\b/i, hex: '#46a758' },
  { match: /\b(gold|yellow)\b/i, hex: '#f5b942' },
  { match: /\borange\b/i, hex: '#f76b15' },
  { match: /\b(purple|violet)\b/i, hex: '#8e4ef7' },
  { match: /\bpink|magenta\b/i, hex: '#e93d82' },
  { match: /\bteal|cyan|turquoise\b/i, hex: '#12a594' },
  { match: /\bwhite|silver\b/i, hex: '#e8e8ec' },
  { match: /\bblack\b/i, hex: '#26262b' },
];

const DEFAULT_COLOR: ColorRule = { match: /blue/i, hex: '#4f8ef7' };

export interface TemplateResult {
  code: string;
}

export function buildTemplateResult(prompt: string): TemplateResult {
  const color = COLORS.find((rule) => rule.match.test(prompt)) ?? DEFAULT_COLOR;
  const title = prompt.trim().slice(0, 80) || 'Generated model';
  return {
    code: buildThreeSceneCode({ title, bodyColor: color.hex }),
  };
}
