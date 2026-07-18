import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { getBlenderMcp, callBlenderTool } from '../mcp/blenderMcp';
import { mcpToolsForAnthropic } from '../mcp/toolBridge';
import { truncate } from '../utils/fsx';

/**
 * The Blender agent: an Anthropic tool-use loop in which Claude drives the
 * live Blender instance through MCP tools (execute_blender_code,
 * get_scene_info, render_frame). This is the "AI model connected to Blender
 * through MCP" path — the model writes bpy code, executes it, reads the
 * results, and iterates.
 */

const DIRECTIVE =
  '\n\n## Current mode\nYou are connected to a live Blender instance through MCP tools. ' +
  'Build or edit the requested scene by calling the tools: inspect with get_scene_info, ' +
  'execute focused bpy code with execute_blender_code, optionally verify with render_frame. ' +
  'Fix any errors reported in tool output. When finished, summarize what you built.';

export interface BlenderAgentStep {
  type: 'text' | 'tool';
  detail: string;
}

export interface BlenderAgentResult {
  steps: BlenderAgentStep[];
  finalText: string;
}

export async function runBlenderAgent(client: Anthropic, prompt: string): Promise<BlenderAgentResult> {
  const mcp = await getBlenderMcp();
  if (!mcp) {
    throw new Error(
      'Blender MCP is disabled or unreachable. Set BLENDER_MCP_ENABLED=true and start the bridge add-on in Blender.',
    );
  }
  const tools = await mcpToolsForAnthropic(mcp);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
  const steps: BlenderAgentStep[] = [];

  for (let iteration = 0; iteration < config.ai.maxAgentIterations; iteration++) {
    const response = await client.messages.create({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      system: `${loadSkill('scene-generation')}\n\n${loadSkill('camera-composition')}${DIRECTIVE}`,
      tools,
      messages,
    });
    messages.push({ role: 'assistant', content: response.content as Anthropic.MessageParam['content'] });

    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        steps.push({ type: 'text', detail: block.text.trim() });
      }
    }

    if (response.stop_reason !== 'tool_use') {
      const finalText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      return { steps, finalText: finalText || 'Done.' };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let output: string;
      let isError = false;
      try {
        output = await callBlenderTool(mcp, block.name, block.input as Record<string, unknown>);
      } catch (err) {
        output = err instanceof Error ? err.message : String(err);
        isError = true;
      }
      steps.push({ type: 'tool', detail: `${block.name} → ${truncate(output, 400)}` });
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: truncate(output, 4000),
        is_error: isError,
      });
    }
    messages.push({ role: 'user', content: results });
  }

  return { steps, finalText: 'Stopped after reaching the agent iteration limit.' };
}
