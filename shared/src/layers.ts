/**
 * Statically extracts and rewrites the mesh-group ("layer") names a generated
 * scene module exposes, without executing the module.
 *
 * `buildScene` returns a flat object mapping names to Three.js objects, e.g.
 * `return { body: body, ground: ground, keyLight: keyLight }` (see
 * `sceneTemplate.ts`). This walks that return statement the same
 * brace-matching way `tunables.ts` walks the PARAMS block, so the models/
 * layers list can be built for every generated model without spinning up a
 * WebGL context per row (that only happens once, live, in the viewport).
 */

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

export function extractLayers(code: string): string[] {
  const returnObj = findBuildSceneReturnObject(code);
  if (!returnObj) return [];
  const keys = extractTopLevelEntries(returnObj.body)
    .map(keyFromEntry)
    .filter((key): key is string => key !== null);
  // De-dupe while preserving first-seen order, in case a key is assigned twice.
  return [...new Set(keys)];
}

/**
 * Renames a returned layer key in `buildScene` and updates `objects.<name>`
 * references in the module (typically `updateScene`). The underlying local
 * binding is left alone so geometry construction stays intact.
 */
export function renameLayer(code: string, oldName: string, newName: string): string {
  const trimmed = newName.trim();
  if (!oldName || !trimmed || oldName === trimmed) return code;
  if (!IDENT_RE.test(trimmed)) return code;

  const layers = extractLayers(code);
  if (!layers.includes(oldName) || layers.includes(trimmed)) return code;

  const withReturn = rewriteReturnKey(code, oldName, (entry) => {
    const colonIndex = entry.indexOf(':');
    if (colonIndex === -1) return `${trimmed}: ${oldName}`;
    return `${trimmed}:${entry.slice(colonIndex + 1)}`;
  });
  if (withReturn === code) return code;

  return withReturn.replace(new RegExp(`\\bobjects\\.${escapeRegExp(oldName)}\\b`, 'g'), `objects.${trimmed}`);
}

/**
 * Removes a layer from the `buildScene` return map, drops `.add(<name>)` calls
 * so the mesh is never attached to the scene, and strips `objects.<name>`
 * usages (usually in `updateScene`). Local `const` declarations are left in
 * place — they become unused and no longer render.
 */
export function deleteLayer(code: string, name: string): string {
  if (!name || !extractLayers(code).includes(name)) return code;

  let next = rewriteReturnKey(code, name, () => null);
  next = removeSceneAddCalls(next, name);
  next = removeObjectsReferenceLines(next, name);
  return next;
}

interface Span {
  start: number;
  end: number;
  body: string;
}

function findBuildSceneReturnObject(code: string): Span | null {
  const fn = findExportedFunctionBody(code, 'buildScene');
  if (!fn) return null;
  const match = /return\s*\{/.exec(fn.body);
  if (!match) return null;
  const openInBody = match.index + match[0].length - 1;
  const closeInBody = findMatchingBrace(fn.body, openInBody);
  if (closeInBody === null) return null;
  const open = fn.start + openInBody;
  const close = fn.start + closeInBody;
  return { start: open + 1, end: close, body: code.slice(open + 1, close) };
}

function findExportedFunctionBody(code: string, name: string): Span | null {
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const match = re.exec(code);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  const end = findMatchingBrace(code, open);
  if (end === null) return null;
  return { start: open + 1, end, body: code.slice(open + 1, end) };
}

function rewriteReturnKey(
  code: string,
  name: string,
  replace: (entry: string) => string | null,
): string {
  const returnObj = findBuildSceneReturnObject(code);
  if (!returnObj) return code;

  const entries = extractTopLevelEntries(returnObj.body);
  const nextEntries: string[] = [];
  let changed = false;
  for (const entry of entries) {
    if (keyFromEntry(entry) !== name) {
      nextEntries.push(entry);
      continue;
    }
    changed = true;
    const rewritten = replace(entry.trim());
    if (rewritten !== null && rewritten.trim()) nextEntries.push(`\n    ${rewritten.trim()}`);
  }
  if (!changed) return code;

  const nextBody =
    nextEntries.length === 0
      ? ''
      : `${nextEntries.map((e) => (e.startsWith('\n') ? e : `\n    ${e.trim()}`)).join(',')}\n  `;
  return code.slice(0, returnObj.start) + nextBody + code.slice(returnObj.end);
}

/** Drops lines like `root.add(head);` / `scene.add(ground);` for the given binding. */
function removeSceneAddCalls(code: string, name: string): string {
  const re = new RegExp(
    `^[ \\t]*[A-Za-z_$][\\w$]*\\.add\\(\\s*${escapeRegExp(name)}\\s*\\);?[ \\t]*\\r?\\n?`,
    'gm',
  );
  return code.replace(re, '');
}

/** Drops any line that references `objects.<name>` (statement or array entry). */
function removeObjectsReferenceLines(code: string, name: string): string {
  const re = new RegExp(
    `^[ \\t]*[^\\n]*\\bobjects\\.${escapeRegExp(name)}\\b[^\\n]*\\r?\\n?`,
    'gm',
  );
  return code.replace(re, '');
}

function findMatchingBrace(text: string, openIndex: number): number | null {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}

/** Splits an object literal's body into its top-level `key: value` entries. */
function extractTopLevelEntries(objectBody: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = '';
  let inString: string | null = null;
  for (let i = 0; i < objectBody.length; i++) {
    const ch = objectBody[i];
    if (inString) {
      current += ch;
      if (ch === '\\') {
        current += objectBody[i + 1] ?? '';
        i++;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      current += ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      entries.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) entries.push(current);
  return entries;
}

/** Extracts the key name from a `key: value` or shorthand `key` entry. */
function keyFromEntry(entry: string): string | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const colonIndex = trimmed.indexOf(':');
  const keyPart = (colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex)).trim();
  return IDENT_RE.test(keyPart) ? keyPart : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
