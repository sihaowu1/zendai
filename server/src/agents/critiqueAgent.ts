import Anthropic from '@anthropic-ai/sdk';
import { validateSceneModule, type ReferenceImage, type SceneSpec } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';
import { trace } from '../utils/trace';

/**
 * The critique agent: looks at rendered viewpoints of a generated model and
 * either accepts it or returns a corrected module. Catches what the pixel
 * check cannot — wrong silhouette, floating parts, bad proportions.
 *
 * The rubric is biased hard toward accepting. Models scoring their own output
 * skew toward gratuitous edits, and a needless rewrite of a good model is a
 * worse outcome here than shipping a slightly imperfect one.
 */

const JS_LANGS = new Set(['js', 'javascript']);

const CRITIQUE_SYSTEM = `You are reviewing a procedurally generated Three.js model by looking at rendered views of it.

**Your default answer is ACCEPT.** These models are stylized approximations built from primitives, not scans. Do not ask for detail the medium cannot deliver, and do not rewrite a model because you would have made different aesthetic choices.

Revise ONLY for a clear, visible defect:
- a part is detached, floating, or intersecting badly enough to read as a mistake
- the silhouette does not read as the requested subject at all
- proportions are obviously wrong (a head twice the size of a torso)
- the subject is clipping through or hovering above the ground plane
- something is missing entirely, or the frame is mostly empty

Do NOT revise for: segment counts, colour taste, missing fine detail, stylization, mild asymmetry, or anything you can only notice by reading the code rather than looking at the render.

Respond in one of exactly two forms:

1. If the model is acceptable, reply with the single word:
CONTINUE

2. If and only if there is a clear defect, state the defect in one sentence, then return the complete corrected module as one \`\`\`javascript block. Change only what fixes the defect — keep every part name, every PARAMS entry, and the overall design intact.`;

export interface CritiqueRequest {
  prompt: string;
  code: string;
  views: Array<{ label: string; base64: string }>;
  referenceImage?: ReferenceImage;
  spec?: SceneSpec;
}

export type CritiqueResult =
  | { action: 'continue'; reason?: string }
  | { action: 'revise'; code: string; reason: string };

export async function critiqueScene(
  client: Anthropic,
  request: CritiqueRequest,
): Promise<CritiqueResult> {
  const content: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [];

  if (request.referenceImage) {
    content.push({ type: 'text', text: 'The user supplied this reference image:' });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: request.referenceImage.mediaType,
        data: request.referenceImage.base64,
      },
    });
  }

  content.push({
    type: 'text',
    text: `The user asked for: ${request.prompt}\n\nHere are rendered views of the model that was generated:`,
  });
  for (const view of request.views) {
    content.push({ type: 'text', text: `View: ${view.label}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: view.base64 },
    });
  }
  content.push({
    type: 'text',
    text:
      `Current scene module:\n\`\`\`javascript\n${request.code}\n\`\`\`\n\n` +
      'Reply CONTINUE unless there is a clear visible defect.',
  });

  trace('critiqueAgent.ts:critiqueScene', 'critique.request', {
    prompt: request.prompt,
    viewLabels: request.views.map((view) => view.label),
    hasReferenceImage: !!request.referenceImage,
    codeChars: request.code.length,
  });

  const startedAt = performance.now();
  const stream = client.messages.stream({
    model: config.ai.model,
    max_tokens: config.ai.maxTokens,
    thinking: { type: 'adaptive' },
    // The contract and craft rules, so a correction stays valid and in style.
    system: `${loadSkill('threejs-modelling')}\n\n${loadSkill('procedural-patterns')}\n\n${CRITIQUE_SYSTEM}`,
    messages: [{ role: 'user', content }],
  });
  const response = await stream.finalMessage();

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  trace('critiqueAgent.ts:critiqueScene', 'critique.response', {
    durationMs: Math.round(performance.now() - startedAt),
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    text,
  });

  if (response.stop_reason === 'refusal') return { action: 'continue' };

  const js = extractFencedBlocks(text).find((block) => JS_LANGS.has(block.lang));
  if (!js) {
    trace('critiqueAgent.ts:critiqueScene', 'critique.accepted', { reason: 'no correction offered' });
    return { action: 'continue', reason: text.trim().slice(0, 300) };
  }

  // A correction that fails the contract is worse than the model we already
  // have, so fall back to accepting rather than shipping something broken.
  const correctionErrors = validateSceneModule(js.code, request.spec);
  if (correctionErrors.length > 0) {
    trace('critiqueAgent.ts:critiqueScene', 'critique.rejected', { errors: correctionErrors });
    return { action: 'continue', reason: 'the proposed correction did not satisfy the module contract' };
  }
  trace('critiqueAgent.ts:critiqueScene', 'critique.revised', { codeChars: js.code.length });

  const reason = text.split('```')[0].trim().slice(0, 300);
  return { action: 'revise', code: js.code, reason: reason || 'corrected a visible defect' };
}
