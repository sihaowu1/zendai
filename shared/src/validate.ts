import { extractParamsBlock } from './tunables';
import type { SceneSpec } from './types';

/**
 * Static checks that generated code satisfies the scene-module contract.
 * Returns a list of human-readable errors (empty means valid). Used by the
 * server (after AI generation) and the web viewport (before hot-loading).
 *
 * When a `spec` is supplied, the module is additionally checked against the
 * structure that was declared before it was written — the layers panel breaks
 * when a named part never reaches the `buildScene` return map, and there is no
 * way to catch that from the code alone.
 */
export function validateSceneModule(code: string, spec?: SceneSpec): string[] {
  const errors: string[] = [];
  if (!code.trim()) {
    return ['the module is empty'];
  }
  if (!/export\s+const\s+PARAMS\s*=\s*\{/.test(code)) {
    errors.push('missing `export const PARAMS = { ... }`');
  }
  if (!/export\s+function\s+buildScene\s*\(/.test(code)) {
    errors.push('missing `export function buildScene(...)`');
  }
  if (!/export\s+function\s+updateScene\s*\(/.test(code)) {
    errors.push('missing `export function updateScene(...)`');
  }
  if (/^\s*import\s/m.test(code)) {
    errors.push('the module must not contain import statements (THREE is provided by the host)');
  }
  if (/\brequire\s*\(/.test(code)) {
    errors.push('the module must not use require()');
  }

  if (spec) errors.push(...checkAgainstSpec(code, spec));

  return errors;
}

/** The two checks the declared structure unlocks, neither visible from code alone. */
function checkAgainstSpec(code: string, spec: SceneSpec): string[] {
  const errors: string[] = [];

  const returnMap = extractBuildSceneReturn(code);
  if (returnMap === null) {
    errors.push('buildScene must end with a `return { ... }` object map of every named part');
  } else {
    const missing = spec.components
      .map((component) => component.id)
      .filter((id) => !new RegExp(`(^|[{,\\s])${escapeRegExp(id)}\\s*[,:}]`).test(returnMap));
    if (missing.length > 0) {
      errors.push(
        `these spec components are missing from the buildScene return map: ${missing.join(', ')}`,
      );
    }
  }

  const params = extractParamsBlock(code);
  if (params) {
    const missing = spec.params
      .map((param) => param.name)
      .filter((name) => !new RegExp(`(^|[{,\\s])${escapeRegExp(name)}\\s*:`).test(params.body));
    if (missing.length > 0) {
      errors.push(`these spec params are missing from the PARAMS block: ${missing.join(', ')}`);
    }
  }

  return errors;
}

/**
 * Body of `buildScene`'s `return { ... }`, or null when there isn't one.
 * Brace-matched from the first `return {` after the function, which is enough
 * because the contract requires the map to be the function's only return.
 */
function extractBuildSceneReturn(code: string): string | null {
  const fn = /export\s+function\s+buildScene\s*\(/.exec(code);
  if (!fn) return null;
  const start = code.indexOf('return', fn.index);
  if (start === -1) return null;
  const open = code.indexOf('{', start);
  if (open === -1 || /[^\s]/.test(code.slice(start + 'return'.length, open))) return null;

  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
