import Anthropic from '@anthropic-ai/sdk';
import { validateSceneModule, type ReferenceImage } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';

/**
 * The scene agent: prompts Claude (with the threejs-modelling skill as its
 * system prompt) to write a component-based Three.js scene module, validates
 * the result against the module contract, and retries once with the
 * validator's feedback if the contract was violated.
 */

const JS_LANGS = new Set(['js', 'javascript']);

const IMAGE_ANALYSIS_ADDENDUM = `

IMPORTANT: The user has attached a reference image. You MUST reconstruct this object faithfully
using the img2threejs reconstruction-by-code methodology. Follow this pipeline strictly:

## Step 1: Structured Decomposition (do this BEFORE writing any code)

**Component Inventory** — identify every distinct part of the subject:
- Name each part (body, lid, handle, base, trim, emblem, hinge, etc.)
- For each, choose the best-fit primitive: BoxGeometry, SphereGeometry, CylinderGeometry,
  ConeGeometry, TorusGeometry, LatheGeometry, ExtrudeGeometry (for profiles/bevels),
  TubeGeometry (for pipes/curves), or composed primitives for complex shapes
- Map the parent-child hierarchy (what attaches to what, and where)
- Measure relative proportions: "the lid is ~30% the height of the body"

**Material Extraction** — for each surface zone:
- Extract the exact hex color from the reference
- Classify: metallic (metalness 0.9–1.0) or dielectric (metalness 0.0–0.05)
- Estimate roughness: mirror-smooth (0.05), satin (0.2–0.4), matte (0.6–0.9)
- Note surface features: bevels, edge rounding, gloss gradients, engravings, patterns, wear

**Lighting & Environment** — from shadows/highlights in the image:
- Primary light direction and approximate intensity
- Whether surfaces show rim lighting or strong ambient occlusion

## Step 2: Build as a Composed Assembly

- Every part from Step 1 becomes a named THREE.Group or THREE.Mesh
- Parts connect at defined attachment points — nothing floats in mid-air
- Use instancing/cloning for repeated elements (bolts, rivets, teeth, slats)
- Apply bevels via ExtrudeGeometry({ bevelEnabled: true }) — real objects have rounded edges

## Step 3: Geometry Priority

Use these techniques in order of preference:
1. Primitives (Box, Sphere, Cylinder, Cone, Torus) for basic shapes
2. Shape + ExtrudeGeometry for profiles, cross-sections, beveled edges
3. LatheGeometry for rotationally symmetric objects (bottles, vases, knobs)
4. TubeGeometry + CatmullRomCurve3 for pipes, cables, organic curves
5. BufferGeometry only when above options cannot achieve the shape

## Step 4: Material Fidelity

- Each logical component gets its own MeshStandardMaterial or MeshPhysicalMaterial
- Colors MUST be extracted from the image, not invented
- Use clearcoat for glossy/lacquered surfaces
- Use canvas-generated textures for surface patterns when detail matters
- Independent PBR channels — never hack albedo to fake roughness or normals

## Step 5: Three-Point Lighting

Match the reference image's lighting with:
- Key light from the inferred direction
- Soft fill light on the opposite side
- Optional rim/back light for edge definition

## Quality Gate

- Proportions MUST match the reference — this is the primary fidelity measure
- Part count should be 8–30 (enough to capture structure, not so many it's wasteful)
- Total polygon budget: under 50k triangles
- State when inference is approximate (unseen sides mirrored from visible geometry)

Use this full analysis to drive the PARAMS values (sizes, proportions, colors, material properties)
and the geometry/hierarchy choices in buildScene. The result should be a faithful procedural
reconstruction of the subject, not a vague approximation.`;

export interface SceneCode {
  code: string;
  blenderCode: string;
}

/** Build user message content — plain string when no image, multimodal array when image is present. */
function buildUserContent(
  text: string,
  image?: ReferenceImage,
): string | Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> {
  if (!image) return text;
  return [
    {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
    },
    { type: 'text' as const, text },
  ];
}

export async function generateScene(
  client: Anthropic,
  prompt: string,
  image?: ReferenceImage,
): Promise<SceneCode> {
  const text = image
    ? `Reconstruct the object in this reference image as a procedural Three.js model.\n\n` +
      `User instruction: ${prompt}\n\n` +
      'Follow the img2threejs pipeline: decompose the subject into components, extract colors ' +
      'and materials from the image, build as a composed assembly of named primitives with ' +
      'faithful proportions, proper PBR materials, and matching lighting. ' +
      'Use named parts with per-part size/color tunables. Do not add time-based animation. ' +
      'Return the ```javascript scene module.'
    : `Create a component-based static Three.js model from this prompt:\n\n${prompt}\n\n` +
      'Use named parts with per-part size tunables. Do not add time-based animation. ' +
      'Return the ```javascript scene module.';
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserContent(text, image) },
  ];
  return completeWithRetry(client, messages, '', !!image);
}

export async function modifyScene(
  client: Anthropic,
  prompt: string,
  code: string,
  blenderCode: string,
  image?: ReferenceImage,
): Promise<SceneCode> {
  const text = image
    ? `Modify the current Three.js model to better match this reference image.\n\n` +
      `Instruction: ${prompt}\n\n` +
      `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
      'Compare the current code against the reference image. Fix proportions, colors, materials, ' +
      'or structure as needed. Use the img2threejs decomposition approach: identify what differs ' +
      'between the current model and the reference, then correct those specific components. ' +
      'Preserve parts that already match. Do not add time-based animation. ' +
      'Return the complete updated ```javascript block.'
    : `Modify the current component-based Three.js model.\n\nInstruction: ${prompt}\n\n` +
      `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
      'Preserve named parts and PARAMS unless the instruction changes them. ' +
      'If asked to swap a part or add variants, update that component (and add style tunables if needed). ' +
      'Do not add time-based animation. ' +
      'Return the complete updated ```javascript block.';
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserContent(text, image) },
  ];
  return completeWithRetry(client, messages, blenderCode, !!image);
}

async function completeWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  previousBlenderCode: string,
  hasImage = false,
): Promise<SceneCode> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      system: hasImage
        ? `${loadSkill('img2threejs')}\n\n${IMAGE_ANALYSIS_ADDENDUM}\n\n${loadSkill('camera-composition')}`
        : `${loadSkill('scene-generation')}\n\n${loadSkill('camera-composition')}`,
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to generate this scene. Try a different prompt.');
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const blocks = extractFencedBlocks(text);
    const js = blocks.find((block) => JS_LANGS.has(block.lang));
    errors = js ? validateSceneModule(js.code) : ['the response did not include a ```javascript block'];
    if (js && errors.length === 0) {
      return { code: js.code, blenderCode: previousBlenderCode };
    }
    // Feed the validator's errors back for one corrective attempt. The full
    // content (including thinking blocks) is echoed back unchanged.
    messages.push({ role: 'assistant', content: response.content as Anthropic.MessageParam['content'] });
    messages.push({
      role: 'user',
      content:
        `That response was rejected by the validator: ${errors.join('; ')}. ` +
        'Return a corrected ```javascript block that follows the contract exactly.',
    });
  }
  throw new Error(`The model did not produce a valid scene module: ${errors.join('; ')}`);
}
