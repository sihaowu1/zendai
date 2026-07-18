import {
  parseTunables,
  type ChatIntent,
  type GenerationResult,
  type IntentModelContext,
  type ReferenceImage,
  type SceneSpec,
} from '@motionforge/shared';
import { getAnthropicClient } from '../ai/client';
import { config } from '../config';
import { trace, withTrace } from '../utils/trace';
import * as animationAgent from './animationAgent';
import { critiqueScene, type CritiqueRequest, type CritiqueResult } from './critiqueAgent';
import { classifyIntent } from './intentAgent';
import * as sceneAgent from './sceneAgent';
import { buildTemplateResult } from './templateFallback';

/** Turn a spec's `subject` (or a raw prompt) into a short, title-cased display name. */
function toDisplayTitle(text: string): string {
  const cleaned = text.trim().replace(/^(a|an|the)\s+/i, '');
  const words = cleaned.split(/\s+/).slice(0, 6).join(' ');
  const capped = words.length > 42 ? `${words.slice(0, 42)}…` : words;
  return capped.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The orchestrator is the single entry point the API routes call. It decides
 * whether a request is served by the AI scene agent or the offline template
 * generator, and always returns code plus the tunables parsed from it.
 */

/**
 * Route one chat message to generate or modify. Without a key there is no
 * classifier, so an existing model means the user is almost certainly editing
 * it — the offline path can't modify, and the caller surfaces that.
 */
export async function resolveIntent(
  prompt: string,
  models: IntentModelContext[],
  activeModelId?: string,
): Promise<ChatIntent> {
  const client = getAnthropicClient();
  if (!client) return { intent: 'generate' };
  return withTrace(
    'intent',
    'orchestrator.ts:resolveIntent',
    { prompt, modelCount: models.length, activeModelId },
    () => classifyIntent(client, prompt, models, activeModelId),
  );
}

export async function generateScene(prompt: string, image?: ReferenceImage): Promise<GenerationResult> {
  return withTrace('generate', 'orchestrator.ts:generateScene', { prompt, hasImage: !!image }, async () => {
    const client = getAnthropicClient();
    if (!client) {
      trace('orchestrator.ts:generateScene', 'path.template', {
        reason: 'no API key configured',
      });
      const template = buildTemplateResult(prompt);
      return {
        ...template,
        tunables: parseTunables(template.code),
        source: 'template' as const,
        title: toDisplayTitle(prompt),
      };
    }
    const result = await sceneAgent.generateScene(client, prompt, image);
    const tunables = parseTunables(result.code);
    trace('orchestrator.ts:generateScene', 'result', {
      codeChars: result.code.length,
      tunableNames: tunables.map((t) => t.name),
      componentIds: result.spec?.components.map((c) => c.id),
      summary: result.summary,
    });
    return {
      ...result,
      tunables,
      source: 'model' as const,
      title: toDisplayTitle(result.spec?.subject ?? prompt),
    };
  });
}

export async function modifyScene(
  prompt: string,
  code: string,
  image?: ReferenceImage,
  spec?: SceneSpec,
): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI modification requires OPENROUTER_API_KEY (the offline template generator cannot apply edits). ' +
        'You can still edit the code directly in the editor.',
    );
  }
  return withTrace(
    'modify',
    'orchestrator.ts:modifyScene',
    { prompt, hasImage: !!image, hasSpec: !!spec, codeChars: code.length },
    async () => {
      const result = await sceneAgent.modifyScene(client, prompt, code, image, spec);
      const tunables = parseTunables(result.code);
      trace('orchestrator.ts:modifyScene', 'result', {
        codeChars: result.code.length,
        tunableNames: tunables.map((t) => t.name),
        componentIds: result.spec?.components.map((c) => c.id),
        summary: result.summary,
      });
      return {
        ...result,
        tunables,
        source: 'model' as const,
        title: result.spec?.subject ? toDisplayTitle(result.spec.subject) : undefined,
      };
    },
  );
}

/**
 * One round of visual critique on a generated model. Behind `ai.critique`,
 * off by default. The client drives the iteration (it owns the renderer that
 * produces the views) and the cap is enforced here so a client can't loop.
 */
export async function critiqueGeneratedScene(
  request: CritiqueRequest & { iteration: number },
): Promise<CritiqueResult & { tunables?: GenerationResult['tunables'] }> {
  if (!config.ai.critique.enabled) return { action: 'continue', reason: 'critique is disabled' };
  if (request.iteration >= config.ai.critique.maxIterations) {
    return { action: 'continue', reason: 'critique iteration cap reached' };
  }
  const client = getAnthropicClient();
  if (!client) return { action: 'continue', reason: 'critique requires OPENROUTER_API_KEY' };

  // Its own trace, not the generate one: the critique loop is driven by the
  // client and arrives as a separate request per iteration.
  return withTrace(
    'critique',
    'orchestrator.ts:critiqueGeneratedScene',
    { prompt: request.prompt, iteration: request.iteration, views: request.views.length },
    async () => {
      const result = await critiqueScene(client, request);
      if (result.action === 'revise') {
        return { ...result, tunables: parseTunables(result.code) };
      }
      return result;
    },
  );
}

export async function animateScene(prompt: string, code: string): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI animation requires OPENROUTER_API_KEY (the offline template generator cannot add animations). ' +
        'You can still edit the code directly in the editor.',
    );
  }
  const result = await animationAgent.animateScene(client, prompt, code);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}
