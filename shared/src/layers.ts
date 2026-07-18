/**
 * Statically extracts the mesh-group ("layer") names a generated scene module
 * exposes, without executing the module.
 *
 * `buildScene` returns a flat object mapping names to Three.js objects, e.g.
 * `return { body: body, ground: ground, keyLight: keyLight }` (see
 * `sceneTemplate.ts`). This walks that return statement the same
 * brace-matching way `tunables.ts` walks the PARAMS block, so the models/
 * layers list can be built for every generated model without spinning up a
 * WebGL context per row (that only happens once, live, in the viewport).
 */
export function extractLayers(code: string): string[] {
  const buildSceneBody = extractFunctionBody(code, 'buildScene');
  if (!buildSceneBody) return [];
  const returnBody = extractReturnObjectBody(buildSceneBody);
  if (returnBody === null) return [];
  const keys = extractTopLevelEntries(returnBody)
    .map(keyFromEntry)
    .filter((key): key is string => key !== null);
  // De-dupe while preserving first-seen order, in case a key is assigned twice.
  return [...new Set(keys)];
}

function extractFunctionBody(code: string, name: string): string | null {
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const match = re.exec(code);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  const end = findMatchingBrace(code, open);
  return end === null ? null : code.slice(open + 1, end);
}

function extractReturnObjectBody(functionBody: string): string | null {
  const match = /return\s*\{/.exec(functionBody);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  const end = findMatchingBrace(functionBody, open);
  return end === null ? null : functionBody.slice(open + 1, end);
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
  return /^[A-Za-z_$][\w$]*$/.test(keyPart) ? keyPart : null;
}
