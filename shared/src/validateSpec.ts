import type { SceneSpec, SpecComponent } from './types';

/**
 * Structural checks on a model-authored SceneSpec. Same contract as
 * `validateSceneModule`: returns human-readable errors, empty means valid.
 * Takes `unknown` because the input is parsed JSON straight off the model.
 *
 * Only hard-structural rules live here. Taste rules stay as prompt guidance in
 * the procedural-patterns skill, since hard-rejecting on taste loops. Roughness
 * variation makes the cut only because roughness is a required schema field.
 */

const COMPLEXITY_RANGES: Record<string, [number, number]> = {
  simple: [3, 8],
  moderate: [8, 20],
  detailed: [20, 60],
};

const MIN_PARAMS = 6;
const MAX_PARAMS = 14;

/**
 * Staging is the viewport's job (background, ground, shadows), so a spec that
 * models its own ground plane is rejected rather than tolerated — two grounds
 * z-fight, and a model-authored one lands wherever the model felt like.
 */
const STAGING_IDS = new Set(['ground', 'floor', 'plane', 'backdrop', 'groundplane', 'floorplane']);

/**
 * Expected `dims` length per primitive — these are the geometry constructor
 * arguments in order. A cylinder specced with a box's three numbers silently
 * builds the wrong shape, so arity is worth catching before turn 2 runs.
 * Primitives absent from this table are not arity-checked.
 */
const DIMS_ARITY: Record<string, number[]> = {
  BoxGeometry: [3],
  CylinderGeometry: [3, 4],
  SphereGeometry: [1, 2, 3],
  ConeGeometry: [2, 3],
  TorusGeometry: [2, 3, 4],
  CapsuleGeometry: [2, 3, 4],
  PlaneGeometry: [2],
  CircleGeometry: [1, 2],
  TetrahedronGeometry: [1, 2],
  IcosahedronGeometry: [1, 2],
  OctahedronGeometry: [1, 2],
  DodecahedronGeometry: [1, 2],
  TorusKnotGeometry: [2, 3, 4],
  RingGeometry: [2, 3],
};

const MIN_LIGHTS = 2;

export function validateSceneSpec(spec: unknown): string[] {
  if (!isRecord(spec)) return ['the spec is not an object'];

  const errors: string[] = [];
  if (typeof spec.subject !== 'string' || !spec.subject.trim()) {
    errors.push('`subject` must be a non-empty string');
  }
  if (typeof spec.complexity !== 'string' || !(spec.complexity in COMPLEXITY_RANGES)) {
    errors.push('`complexity` must be one of: simple, moderate, detailed');
  }
  if (!isRecord(spec.materials)) errors.push('`materials` must be an object');
  if (!Array.isArray(spec.lights)) errors.push('`lights` must be an array');
  if (!Array.isArray(spec.components)) errors.push('`components` must be an array');
  if (!Array.isArray(spec.params)) errors.push('`params` must be an array');
  if (!isRecord(spec.camera)) errors.push('`camera` must be an object');

  // Everything past this point indexes into components/materials/params, so
  // bail rather than report a cascade of errors from a broken shape.
  if (errors.length > 0) return errors;

  const components = spec.components as unknown[];
  const materials = spec.materials as Record<string, unknown>;
  const params = spec.params as unknown[];

  errors.push(...checkComponents(components));
  if (errors.length > 0) return errors;

  const typed = components as SpecComponent[];
  const ids = new Set(typed.map((c) => c.id));
  if (ids.size !== typed.length) {
    errors.push('component ids must be unique');
  }

  errors.push(...checkHierarchy(typed, ids));
  errors.push(...checkComplexity(spec.complexity as string, typed.length));
  errors.push(...checkMaterials(typed, materials));
  errors.push(...checkParams(params, ids, new Set(Object.keys(materials))));

  // The module carries its own lights — the Remotion renderer adds none, so a
  // single-light spec is what a flat, unreadable MP4 looks like at the source.
  if ((spec.lights as unknown[]).length < MIN_LIGHTS) {
    errors.push(
      `\`lights\` needs at least ${MIN_LIGHTS} entries (key plus fill, ideally a rim too) — ` +
        'the module lights itself when exported or rendered',
    );
  }

  return errors;
}

function checkComponents(components: unknown[]): string[] {
  if (components.length === 0) return ['`components` must not be empty'];
  const errors: string[] = [];
  components.forEach((component, i) => {
    if (!isRecord(component)) {
      errors.push(`components[${i}] is not an object`);
      return;
    }
    const where = typeof component.id === 'string' ? `component "${component.id}"` : `components[${i}]`;
    if (typeof component.id !== 'string' || !component.id.trim()) {
      errors.push(`${where} needs a non-empty string \`id\``);
    }
    if (component.parent !== null && typeof component.parent !== 'string') {
      errors.push(`${where} needs \`parent\` to be a component id or null`);
    }
    if (typeof component.primitive !== 'string' || !component.primitive.trim()) {
      errors.push(`${where} needs a non-empty string \`primitive\``);
    }
    if (!isNumberArray(component.dims) || component.dims.length === 0) {
      errors.push(`${where} needs \`dims\` as a non-empty array of numbers`);
    } else if (typeof component.primitive === 'string') {
      const allowed = DIMS_ARITY[component.primitive];
      if (allowed && !allowed.includes(component.dims.length)) {
        errors.push(
          `${where} is a ${component.primitive} with ${component.dims.length} \`dims\`, ` +
            `but that geometry takes ${allowed.join(' or ')}`,
        );
      }
    }
    if (typeof component.id === 'string' && STAGING_IDS.has(component.id.toLowerCase())) {
      errors.push(
        `${where} is scene staging — the viewport supplies the ground and background, ` +
          'so model only the subject itself',
      );
    }
    if (!isVec3(component.position)) {
      errors.push(`${where} needs \`position\` as [x, y, z]`);
    }
    if (component.rotation !== undefined && !isVec3(component.rotation)) {
      errors.push(`${where} has a \`rotation\` that is not [x, y, z]`);
    }
    if (component.pivot !== undefined && !isVec3(component.pivot)) {
      errors.push(`${where} has a \`pivot\` that is not [x, y, z]`);
    }
    if (typeof component.material !== 'string' || !component.material.trim()) {
      errors.push(`${where} needs a non-empty string \`material\``);
    }
  });
  return errors;
}

function checkHierarchy(components: SpecComponent[], ids: Set<string>): string[] {
  const errors: string[] = [];
  const byId = new Map(components.map((c) => [c.id, c]));

  for (const component of components) {
    if (component.parent !== null && !ids.has(component.parent)) {
      errors.push(`component "${component.id}" has parent "${component.parent}", which is not a component id`);
    }
  }
  if (errors.length > 0) return errors;

  // Walk each component to its root; a chain longer than the component count
  // has revisited a node, which is the cycle.
  for (const component of components) {
    let cursor: SpecComponent | undefined = component;
    let steps = 0;
    while (cursor?.parent) {
      cursor = byId.get(cursor.parent);
      if (++steps > components.length) {
        errors.push(`component "${component.id}" is part of a parent cycle`);
        break;
      }
    }
  }
  if (errors.length > 0) return errors;

  const roots = components.filter((c) => c.parent === null);
  if (roots.length === 0) {
    errors.push('every component has a parent — the hierarchy needs one root');
  } else if (roots.length > 1) {
    errors.push(
      `expected one root component; extra roots without a parent: ${roots
        .slice(1)
        .map((r) => `"${r.id}"`)
        .join(', ')}`,
    );
  }
  return errors;
}

function checkComplexity(complexity: string, count: number): string[] {
  const [min, max] = COMPLEXITY_RANGES[complexity];
  if (count < min || count > max) {
    return [`complexity "${complexity}" expects ${min}–${max} components, got ${count}`];
  }
  return [];
}

function checkMaterials(components: SpecComponent[], materials: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const keys = Object.keys(materials);
  if (keys.length === 0) return ['`materials` must define at least one material'];

  const roughness: number[] = [];
  for (const key of keys) {
    const material = materials[key];
    if (!isRecord(material)) {
      errors.push(`material "${key}" is not an object`);
      continue;
    }
    if (typeof material.color !== 'string') errors.push(`material "${key}" needs a string \`color\``);
    if (typeof material.roughness !== 'number') errors.push(`material "${key}" needs a numeric \`roughness\``);
    else roughness.push(material.roughness);
    if (typeof material.metalness !== 'number') errors.push(`material "${key}" needs a numeric \`metalness\``);
  }

  for (const component of components) {
    if (!(component.material in materials)) {
      errors.push(`component "${component.id}" references material "${component.material}", which is not defined`);
    }
  }

  // Flat uniform materials are the single biggest tell of generated 3D.
  if (roughness.length > 1 && new Set(roughness).size === 1) {
    errors.push('every material shares the same roughness — vary it per material');
  }
  return errors;
}

/**
 * `targets` exists to tie every param to real structure, so a param that drives
 * nothing can't ship. A colour param usually drives a *material* shared by many
 * parts rather than one component, so material keys count as targets too —
 * requiring it to re-list every component using that material is busywork the
 * model reliably gets wrong.
 */
function checkParams(params: unknown[], ids: Set<string>, materialKeys: Set<string>): string[] {
  const errors: string[] = [];
  if (params.length < MIN_PARAMS || params.length > MAX_PARAMS) {
    errors.push(`expected ${MIN_PARAMS}–${MAX_PARAMS} params, got ${params.length}`);
  }

  params.forEach((param, i) => {
    if (!isRecord(param)) {
      errors.push(`params[${i}] is not an object`);
      return;
    }
    const where = typeof param.name === 'string' ? `param "${param.name}"` : `params[${i}]`;
    if (typeof param.name !== 'string' || !param.name.trim()) {
      errors.push(`${where} needs a non-empty string \`name\``);
    }
    if (typeof param.label !== 'string' || !param.label.trim()) {
      errors.push(`${where} needs a non-empty string \`label\``);
    }
    if (param.type !== 'number' && param.type !== 'boolean' && param.type !== 'color') {
      errors.push(`${where} needs \`type\` to be number, boolean, or color`);
    }
    if (param.type === 'number') {
      for (const field of ['min', 'max', 'step'] as const) {
        if (typeof param[field] !== 'number') errors.push(`${where} is a number param and needs \`${field}\``);
      }
    }
    if (!Array.isArray(param.targets) || param.targets.length === 0) {
      errors.push(
        `${where} needs \`targets\` listing the component ids or material keys it drives`,
      );
      return;
    }
    for (const target of param.targets as unknown[]) {
      if (typeof target !== 'string' || !(ids.has(target) || materialKeys.has(target))) {
        errors.push(
          `${where} targets "${String(target)}", which is not a component id or material key`,
        );
      }
    }
  });

  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number');
}

function isVec3(value: unknown): value is [number, number, number] {
  return isNumberArray(value) && value.length === 3;
}

/** Narrow a validated spec. Only sound after `validateSceneSpec` returns empty. */
export function asSceneSpec(spec: unknown): SceneSpec {
  return spec as SceneSpec;
}
