import Anthropic from '@anthropic-ai/sdk';
import {
  asSceneSpec,
  validateSceneModule,
  validateSceneSpec,
  type ReferenceImage,
  type SceneSpec,
} from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';
import { trace } from '../utils/trace';

/**
 * The scene agent. Generation runs as two exchanges in one conversation:
 * turn 1 produces a structural SceneSpec, turn 2 writes the module from it.
 *
 * One conversation rather than two calls: the system prompt (two skills) is
 * paid once and stays prompt-cached, and turn 2 sees the spec verbatim in
 * context instead of a paraphrase it can drift from.
 *
 * Each turn validates in code — `validateSceneSpec` between the turns,
 * `validateSceneModule` after — and retries once with the validator's errors.
 * A spec rejection costs ~1.5k tokens; a module rejection costs a full module,
 * which is why the tunable rules live in the spec turn.
 */

const JS_LANGS = new Set(['js', 'javascript']);

const MAX_ATTEMPTS = 2;

const IMAGE_ANALYSIS_ADDENDUM = `

The user has attached a reference image. Before writing the scene module, analyze the image:
1. Decompose the subject into named 3D components. For each, choose the best-fit Three.js primitive (BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, etc.).
2. Extract dominant colors as hex values. Estimate material properties (metalness 0–1, roughness 0–1).
3. Identify proportions and relative sizes between parts, and the parent-child hierarchy.
4. Estimate lighting direction and intensity from shadows/highlights in the image.
Use this analysis to drive the PARAMS values (sizes, colors) and the geometry choices in buildScene.`;

const SPEC_TURN_INSTRUCTIONS = `

## Two-turn workflow

You answer in two turns. Do not write any Three.js code until the second turn.

**Turn 1 — the spec.** Return exactly one \`\`\`json block and nothing else, matching:

{
  "subject": "short description of what is being modelled",
  "complexity": "simple" | "moderate" | "detailed",
  "components": [
    {
      "id": "camelCaseName",
      "parent": null,
      "primitive": "BoxGeometry",
      "dims": [1, 1, 1],
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "pivot": [0, 0, 0],
      "material": "materialKey"
    }
  ],
  "materials": { "materialKey": { "color": "#rrggbb", "roughness": 0.4, "metalness": 0 } },
  "lights": [{ "type": "DirectionalLight", "position": [3, 4, 3], "intensity": 2.4, "color": "#ffffff" }],
  "camera": { "position": [4, 2.6, 5.5], "lookAt": [0, 0.8, 0], "fov": 45 },
  "params": [
    {
      "name": "headSize",
      "label": "Head size",
      "type": "number",
      "value": 1,
      "min": 0.5,
      "max": 2,
      "step": 0.05,
      "targets": ["head"]
    }
  ]
}

\`dims\` is the geometry's constructor arguments, in order, and its length is
checked against \`primitive\`:

| primitive | dims | notes |
| --- | --- | --- |
| \`BoxGeometry\` | \`[width, height, depth]\` | width on X, height on Y, depth on Z |
| \`CylinderGeometry\` | \`[radiusTop, radiusBottom, height, radialSegments]\` | axis is **+Y** — rotate to lay it down |
| \`SphereGeometry\` | \`[radius, widthSegments, heightSegments]\` | |
| \`ConeGeometry\` | \`[radius, height, radialSegments]\` | axis is **+Y** |
| \`TorusGeometry\` | \`[radius, tube, radialSegments, tubularSegments]\` | |
| \`CapsuleGeometry\` | \`[radius, length, capSegments, radialSegments]\` | axis is **+Y** |

\`position\` is relative to the component's parent. \`rotation\` is in radians.

Apply the axis convention from the contract when you place things: **+Y up,
+Z forward, +X the subject's right**. The subject's long axis is Z, left/right
pairs differ only in the sign of X, front parts are at +Z, and the lowest point
of the whole model is \`y = 0\`. A wheel of radius \`r\` sits at \`y = r\` with
\`"rotation": [0, 0, 1.5708]\` so its axle runs along X.

Do not include a ground, floor, or backdrop component — the viewport supplies
those. Do include a real light rig; the module renders on its own when exported.

The spec is validated in code before turn 2 runs. It is rejected unless:

- every \`parent\` is null or another component's \`id\`, with no cycles
- there is exactly one root, and it is not a ground/floor/backdrop plane
- every component's \`dims\` length matches its \`primitive\` (table above)
- there are at least two lights
- the component count matches \`complexity\`: simple 3–8, moderate 8–20, detailed 20–60
- every component's \`material\` is a key in \`materials\`
- the \`materials\` do not all share one roughness value
- every \`"type": "number"\` param has \`min\`, \`max\`, and \`step\`
- there are 6–14 params
- every entry in \`params[].targets\` is a real component id or a real \`materials\` key

\`targets\` says what the param drives, and every param needs a non-empty one.
Size params list component ids (\`"targets": ["head"]\`); a colour param that
recolours a shared material lists that material key instead
(\`"targets": ["shellPaint"]\`) rather than re-listing every component using it.

\`rotation\` and \`pivot\` are optional; omit them when they would be zero.

**Turn 2 — the module.** You will be asked to write the scene module from the
spec you just returned. Follow it: every \`components[].id\` must appear in the
\`buildScene\` return map under that exact name, and every \`params[].name\` must
appear in \`PARAMS\` with the annotations the contract requires. Both are checked
in code. Apply the craft guidance when choosing segment counts, detail, and
exact colours — the spec fixes the structure, not every visual decision.`;

/**
 * Appended to every code-turn request. The summary rides along with the module
 * instead of costing a second round-trip, and the fence keeps it out of the
 * javascript block the extractor is looking for.
 */
const SUMMARY_REQUEST =
  '\n\nAfter the javascript block, add a ```summary block: one or two sentences, ' +
  'plain language, telling the user what you built or changed and why it looks the ' +
  'way it does. Name the parts you touched. No code, no markdown, no jargon like ' +
  '"PARAMS" or "buildScene" — the reader is looking at a 3D model, not the source.';

const CODE_TURN_REQUEST =
  'The spec is valid. Now write the Three.js scene module from it.\n\n' +
  'Every component id must appear in the buildScene return map under that exact name, ' +
  'and every spec param must appear in PARAMS with its @tunable annotations. ' +
  'Do not add time-based animation. Return exactly one ```javascript block.' +
  SUMMARY_REQUEST;

export interface SceneCode {
  code: string;
  spec?: SceneSpec;
  summary?: string;
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

/**
 * The system prompt, identical across both turns so the conversation stays
 * prompt-cached. `threejs-modelling` is the contract, `procedural-patterns` is
 * the craft guidance that makes the output worth shipping.
 */
function systemPrompt(hasImage: boolean): string {
  return (
    loadSkill('threejs-modelling') +
    '\n\n' +
    loadSkill('procedural-patterns') +
    SPEC_TURN_INSTRUCTIONS +
    (hasImage ? IMAGE_ANALYSIS_ADDENDUM : '')
  );
}

export async function generateScene(
  client: Anthropic,
  prompt: string,
  image?: ReferenceImage,
): Promise<SceneCode> {
  const system = systemPrompt(!!image);
  const text =
    `Create a component-based static Three.js model from this prompt:\n\n${prompt}\n\n` +
    'Start with turn 1: return the ```json spec.';
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserContent(text, image) },
  ];

  const spec = await runSpecTurn(client, messages, system);
  messages.push({ role: 'user', content: CODE_TURN_REQUEST });
  const { code, summary } = await runCodeTurn(client, messages, system, spec);
  return { code, spec, summary };
}

export async function modifyScene(
  client: Anthropic,
  prompt: string,
  code: string,
  image?: ReferenceImage,
  spec?: SceneSpec,
): Promise<SceneCode> {
  const system = systemPrompt(!!image);

  // With a spec, the edit is applied to the declared structure first and the
  // module is regenerated from it, so repeated edits can't drift away from it.
  if (spec) {
    const text =
      `Modify the current component-based Three.js model.\n\nInstruction: ${prompt}\n\n` +
      `Current spec:\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\n` +
      `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
      'Turn 1: return the complete updated ```json spec. Change only what the instruction ' +
      'requires — keep every other component id, material, and param name exactly as it is.';
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: buildUserContent(text, image) },
    ];
    const nextSpec = await runSpecTurn(client, messages, system);
    messages.push({
      role: 'user',
      content:
        'The updated spec is valid. Now write the complete updated scene module from it.\n\n' +
        'Preserve the existing implementation for everything the instruction did not change. ' +
        'Do not add time-based animation. Return exactly one ```javascript block.' +
        SUMMARY_REQUEST,
    });
    const result = await runCodeTurn(client, messages, system, nextSpec);
    return { code: result.code, spec: nextSpec, summary: result.summary };
  }

  // No spec: projects created before the spec existed, and template output.
  // Unchanged single-turn behavior.
  const text =
    `Modify the current component-based Three.js model.\n\nInstruction: ${prompt}\n\n` +
    `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
    'Preserve named parts and PARAMS unless the instruction changes them. ' +
    'If asked to swap a part or add variants, update that component (and add style tunables if needed). ' +
    'Do not add time-based animation. ' +
    'Return the complete updated ```javascript block. Skip the spec turn.' +
    SUMMARY_REQUEST;
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserContent(text, image) },
  ];
  const result = await runCodeTurn(client, messages, system, undefined);
  return { code: result.code, summary: result.summary };
}

/** Ask the model for a completion and return its text plus raw content blocks. */
async function complete(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  system: string,
): Promise<{ text: string; content: Anthropic.ContentBlock[] }> {
  // The last message is the actual instruction for this turn; the ones before
  // it are context the trace already recorded when they were added.
  const last = messages[messages.length - 1];
  trace('sceneAgent.ts:complete', 'model.request', {
    model: config.ai.model,
    maxTokens: config.ai.maxTokens,
    systemChars: system.length,
    messageCount: messages.length,
    lastMessage: last?.content,
  });

  const startedAt = performance.now();
  const stream = client.messages.stream({
    model: config.ai.model,
    max_tokens: config.ai.maxTokens,
    thinking: { type: 'adaptive' },
    system,
    messages,
  });
  const response = await stream.finalMessage();
  const durationMs = Math.round(performance.now() - startedAt);

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  trace('sceneAgent.ts:complete', 'model.response', {
    durationMs,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens,
    cacheCreationTokens: response.usage.cache_creation_input_tokens,
    blockTypes: response.content.map((block) => block.type),
    text,
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to generate this scene. Try a different prompt.');
  }
  return { text, content: response.content };
}

/**
 * Turn 1. Appends the accepted spec to `messages` as an assistant turn so the
 * code turn sees it verbatim. Retries turn 1 alone on a validation failure —
 * a bad spec is cheap to redo and there is no point paying for a module built
 * on one.
 */
async function runSpecTurn(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  system: string,
): Promise<SceneSpec> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    trace('sceneAgent.ts:runSpecTurn', 'spec.attempt', { attempt: attempt + 1, of: MAX_ATTEMPTS });
    const { text, content } = await complete(client, messages, system);
    const block = extractFencedBlocks(text).find((entry) => entry.lang === 'json');

    let parsed: unknown;
    if (!block) {
      errors = ['the response did not include a ```json block'];
    } else {
      try {
        parsed = JSON.parse(block.code);
        errors = validateSceneSpec(parsed);
      } catch (err) {
        errors = [
          'the ```json block was not valid JSON: ' +
            (err instanceof Error ? err.message : String(err)),
        ];
      }
    }

    // The spec itself, not a summary of it: this is the document every later
    // step is derived from, and the one thing worth having verbatim when the
    // module comes out wrong.
    trace('sceneAgent.ts:runSpecTurn', 'spec.validated', {
      attempt: attempt + 1,
      accepted: errors.length === 0,
      errors,
      spec: parsed ?? null,
    });

    if (errors.length === 0) {
      messages.push({ role: 'assistant', content: content as Anthropic.MessageParam['content'] });
      return asSceneSpec(parsed);
    }

    messages.push({ role: 'assistant', content: content as Anthropic.MessageParam['content'] });
    messages.push({
      role: 'user',
      content:
        `That spec was rejected by the validator: ${errors.join('; ')}. ` +
        'Return a corrected ```json spec.',
    });
  }
  trace('sceneAgent.ts:runSpecTurn', 'spec.exhausted', { attempts: MAX_ATTEMPTS, errors });
  throw new Error(`The model did not produce a valid scene spec: ${errors.join('; ')}`);
}

/**
 * Turn 2. When a spec is present the module is additionally checked against it
 * (every component id in the return map, every param in PARAMS).
 */
async function runCodeTurn(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  system: string,
  spec: SceneSpec | undefined,
): Promise<{ code: string; summary?: string }> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    trace('sceneAgent.ts:runCodeTurn', 'code.attempt', {
      attempt: attempt + 1,
      of: MAX_ATTEMPTS,
      checkedAgainstSpec: !!spec,
    });
    const { text, content } = await complete(client, messages, system);
    const blocks = extractFencedBlocks(text);
    const js = blocks.find((block) => JS_LANGS.has(block.lang));
    errors = js
      ? validateSceneModule(js.code, spec)
      : ['the response did not include a ```javascript block'];

    trace('sceneAgent.ts:runCodeTurn', 'code.validated', {
      attempt: attempt + 1,
      accepted: !!js && errors.length === 0,
      errors,
      blockLangs: blocks.map((block) => block.lang),
      code: js?.code ?? null,
    });

    // The summary is presentation, not contract — a module that validates is
    // never rejected for arriving without one.
    if (js && errors.length === 0) {
      const summary = blocks.find((block) => block.lang === 'summary')?.code.trim();
      return { code: js.code, summary: summary || undefined };
    }

    // Feed the validator's errors back for one corrective attempt. The full
    // content (including thinking blocks) is echoed back unchanged.
    messages.push({ role: 'assistant', content: content as Anthropic.MessageParam['content'] });
    messages.push({
      role: 'user',
      content:
        `That response was rejected by the validator: ${errors.join('; ')}. ` +
        'Return a corrected ```javascript block that follows the contract exactly.',
    });
  }
  trace('sceneAgent.ts:runCodeTurn', 'code.exhausted', { attempts: MAX_ATTEMPTS, errors });
  throw new Error(`The model did not produce a valid scene module: ${errors.join('; ')}`);
}
