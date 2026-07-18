import {
  buildBlenderSceneCode,
  buildThreeSceneCode,
} from '@motionforge/shared';

/**
 * Deterministic offline generator used when no OPENROUTER_API_KEY is set.
 * It maps prompt keywords onto the shared parametric scene templates so the
 * whole pipeline (editor → controls → Remotion → Blender) stays runnable
 * without network access.
 */

interface PrimitiveRule {
  match: RegExp;
  three: string;
  blender: string;
}

const PRIMITIVES: PrimitiveRule[] = [
  {
    match: /\b(cube|box)\b/i,
    three: 'new THREE.BoxGeometry(params.radius * 1.6, params.radius * 1.6, params.radius * 1.6)',
    blender: 'bpy.ops.mesh.primitive_cube_add(size=PARAMS["radius"] * 1.6)',
  },
  {
    match: /\btorus\s*knot\b/i,
    three: 'new THREE.TorusKnotGeometry(params.radius, params.radius * 0.3, 128, 24)',
    blender:
      'bpy.ops.mesh.primitive_torus_add(major_radius=PARAMS["radius"], minor_radius=PARAMS["radius"] * 0.3)',
  },
  {
    match: /\b(torus|donut|ring)\b/i,
    three: 'new THREE.TorusGeometry(params.radius, params.radius * 0.35, 24, 64)',
    blender:
      'bpy.ops.mesh.primitive_torus_add(major_radius=PARAMS["radius"], minor_radius=PARAMS["radius"] * 0.35)',
  },
  {
    match: /\bcone\b/i,
    three: 'new THREE.ConeGeometry(params.radius, params.radius * 2, 48)',
    blender:
      'bpy.ops.mesh.primitive_cone_add(radius1=PARAMS["radius"], depth=PARAMS["radius"] * 2)',
  },
  {
    match: /\bcylinder\b/i,
    three: 'new THREE.CylinderGeometry(params.radius, params.radius, params.radius * 2, 48)',
    blender:
      'bpy.ops.mesh.primitive_cylinder_add(radius=PARAMS["radius"], depth=PARAMS["radius"] * 2)',
  },
];

const DEFAULT_PRIMITIVE: PrimitiveRule = {
  match: /sphere/i,
  three: 'new THREE.IcosahedronGeometry(params.radius, 3)',
  blender: 'bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=PARAMS["radius"])',
};

interface ColorRule {
  match: RegExp;
  hex: string;
  rgb: [number, number, number];
}

const COLORS: ColorRule[] = [
  { match: /\bred|crimson\b/i, hex: '#e5484d', rgb: [0.9, 0.28, 0.3] },
  { match: /\bgreen|emerald\b/i, hex: '#46a758', rgb: [0.27, 0.65, 0.35] },
  { match: /\b(gold|yellow)\b/i, hex: '#f5b942', rgb: [0.96, 0.73, 0.26] },
  { match: /\borange\b/i, hex: '#f76b15', rgb: [0.97, 0.42, 0.08] },
  { match: /\b(purple|violet)\b/i, hex: '#8e4ef7', rgb: [0.56, 0.31, 0.97] },
  { match: /\bpink|magenta\b/i, hex: '#e93d82', rgb: [0.91, 0.24, 0.51] },
  { match: /\bteal|cyan|turquoise\b/i, hex: '#12a594', rgb: [0.07, 0.65, 0.58] },
  { match: /\bwhite|silver\b/i, hex: '#e8e8ec', rgb: [0.91, 0.91, 0.93] },
  { match: /\bblack\b/i, hex: '#26262b', rgb: [0.15, 0.15, 0.17] },
];

const DEFAULT_COLOR: ColorRule = { match: /blue/i, hex: '#4f8ef7', rgb: [0.31, 0.56, 0.97] };

export interface TemplateResult {
  code: string;
  blenderCode: string;
}

export function buildTemplateResult(prompt: string): TemplateResult {
  const primitive = PRIMITIVES.find((rule) => rule.match.test(prompt)) ?? DEFAULT_PRIMITIVE;
  const color = COLORS.find((rule) => rule.match.test(prompt)) ?? DEFAULT_COLOR;
  const title = prompt.trim().slice(0, 80) || 'Generated scene';
  return {
    code: buildThreeSceneCode({ title, geometryExpr: primitive.three, bodyColor: color.hex }),
    blenderCode: buildBlenderSceneCode({
      title,
      primitiveCall: primitive.blender,
      bodyColorRgb: color.rgb,
    }),
  };
}
