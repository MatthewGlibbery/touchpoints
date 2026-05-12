import { supabase } from './supabase';
import type { Blueprint, Actor, StoryboardStyleGuide, StoryboardFrame } from '../types/blueprint';

// ─── Style guide generation ───────────────────────────────────────────────────

export async function generateStyleGuide(
  blueprint: Blueprint,
  baseStyle: string
): Promise<StoryboardStyleGuide> {
  const actorList = blueprint.actors
    .sort((a, b) => a.order - b.order)
    .map((a) => `- ${a.name}${a.bio ? `: ${a.bio}` : ''}${a.goals ? ` (goals: ${a.goals})` : ''}`)
    .join('\n');

  const { data, error } = await supabase.functions.invoke('ai-storyboard', {
    body: {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a character designer for an anime storyboard. Given a list of actors from a service blueprint, create vivid, specific visual character descriptions that will produce consistent illustrations when used in image generation prompts.

Each description must be 1–2 sentences covering: approximate age, gender, hair (color + style), skin tone, key clothing/outfit, distinctive features, and typical expression/body language. Write in a style optimized for image generation prompts (descriptive phrases, not sentences).

Style context: ${baseStyle}`,
      tools: [characterDescTool],
      tool_choice: { type: 'any' },
      messages: [
        {
          role: 'user',
          content: `Create character descriptions for these actors:\n${actorList}\n\nService: ${blueprint.name}`,
        },
      ],
    },
  });

  if (error || !data) return { baseStyle, characterDescriptions: {} };

  const content = (data as { content: Array<{ type: string; input?: unknown }> }).content;
  const toolUse = content.find((b) => b.type === 'tool_use');
  if (!toolUse) return { baseStyle, characterDescriptions: {} };

  const raw = toolUse.input as { characters: Array<{ actorName: string; description: string }> };
  const characterDescriptions: Record<string, string> = {};

  for (const { actorName, description } of raw.characters ?? []) {
    const actor = blueprint.actors.find(
      (a) => a.name.toLowerCase() === actorName.toLowerCase()
    );
    if (actor) {
      characterDescriptions[actor.id] = description;
    }
  }

  return { baseStyle, characterDescriptions };
}

// ─── Frame structure generation ──────────────────────────────────────────────

export async function generateFrameStructure(
  blueprint: Blueprint,
  styleGuide: StoryboardStyleGuide
): Promise<Omit<StoryboardFrame, 'id' | 'order' | 'imagePrompt'>[]> {
  const phases = blueprint.phases.sort((a, b) => a.order - b.order);
  const actors = blueprint.actors.sort((a, b) => a.order - b.order);

  const phasesSummary = phases.map((ph) => {
    const phaseActions = blueprint.actions
      .filter((a) => a.phaseId === ph.id)
      .sort((a, b) => a.order - b.order);
    const actorNames = [...new Set(phaseActions.map((a) => actors.find((ac) => ac.id === a.actorId)?.name).filter(Boolean))];
    const actionLabels = phaseActions.map((a) => `${actors.find((ac) => ac.id === a.actorId)?.name}: ${a.label}`).join('; ');
    return `Phase "${ph.name}" — actors: ${actorNames.join(', ')} — steps: ${actionLabels}`;
  }).join('\n');

  const characterList = actors
    .map((a) => `${a.name}: ${styleGuide.characterDescriptions[a.id] ?? 'no description'}`)
    .join('\n');

  const { data, error } = await supabase.functions.invoke('ai-storyboard', {
    body: {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a storyboard director for an anime-style visual narrative. Given a service blueprint, create storyboard frames that tell the story of the service journey in a compelling, cinematic way.

Each frame should:
- Capture a key dramatic or emotional moment in the journey
- Show characters interacting naturally with each other or the environment
- Have a concise, evocative caption (1–2 sentences, narrative voice, present tense)
- Include a vivid scene description that will work well as an image prompt

Create one frame per phase (combine minor phases if needed). Frames should flow as a coherent visual story.`,
      tools: [frameStructureTool],
      tool_choice: { type: 'any' },
      messages: [
        {
          role: 'user',
          content: `Service: ${blueprint.name}\n\nPhases and actions:\n${phasesSummary}\n\nCharacters:\n${characterList}\n\nCreate storyboard frames for this journey.`,
        },
      ],
    },
  });

  if (error || !data) return [];

  const content = (data as { content: Array<{ type: string; input?: unknown }> }).content;
  const toolUse = content.find((b) => b.type === 'tool_use');
  if (!toolUse) return [];

  const raw = toolUse.input as {
    frames: Array<{
      phaseNames: string[];
      actorNames: string[];
      sceneDescription: string;
      caption: string;
    }>;
  };

  const actorByName = new Map(blueprint.actors.map((a) => [a.name.toLowerCase(), a]));
  const phaseByName = new Map(blueprint.phases.map((p) => [p.name.toLowerCase(), p]));

  return (raw.frames ?? []).map((f) => ({
    sceneDescription: f.sceneDescription,
    caption: f.caption,
    phaseIds: (f.phaseNames ?? []).map((n) => phaseByName.get(n.toLowerCase())?.id).filter(Boolean) as string[],
    actorIds: (f.actorNames ?? []).map((n) => actorByName.get(n.toLowerCase())?.id).filter(Boolean) as string[],
    imageUrl: undefined,
  }));
}

// ─── Image prompt construction ───────────────────────────────────────────────

export function buildImagePrompt(
  frame: Pick<StoryboardFrame, 'sceneDescription' | 'actorIds'>,
  styleGuide: StoryboardStyleGuide,
  actors: Actor[]
): string {
  const charDescs = frame.actorIds
    .map((id) => {
      const actor = actors.find((a) => a.id === id);
      const desc = styleGuide.characterDescriptions[id];
      return actor && desc ? `${actor.name} (${desc})` : null;
    })
    .filter(Boolean) as string[];

  const parts = [
    styleGuide.baseStyle,
    frame.sceneDescription,
    ...(charDescs.length ? [`Characters: ${charDescs.join('; ')}`] : []),
    'detailed illustration, high quality',
  ];

  return parts.join(', ');
}

// ─── Image generation (DALL-E 3 via Edge Function → Supabase Storage) ────────

export async function generateImage(
  prompt: string,
  blueprintId: string,
  frameId: string
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('ai-storyboard', {
    body: { type: 'image', prompt, blueprintId, frameId },
  });

  if (error) {
    console.error('Image generation failed:', error);
    return null;
  }

  return (data as { url: string | null }).url ?? null;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const characterDescTool = {
  name: 'create_character_descriptions',
  description: 'Create visual character descriptions for storyboard consistency',
  input_schema: {
    type: 'object' as const,
    required: ['characters'],
    properties: {
      characters: {
        type: 'array',
        items: {
          type: 'object',
          required: ['actorName', 'description'],
          properties: {
            actorName: { type: 'string', description: 'Must match an actor name exactly' },
            description: {
              type: 'string',
              description: 'Visual description: age, gender, hair, skin tone, clothing, distinctive features, expression/body language. 1-2 sentences, optimized for image generation.',
            },
          },
        },
      },
    },
  },
};

const frameStructureTool = {
  name: 'create_storyboard_frames',
  description: 'Create storyboard frames for a service journey',
  input_schema: {
    type: 'object' as const,
    required: ['frames'],
    properties: {
      frames: {
        type: 'array',
        description: 'One frame per major phase or narrative beat',
        items: {
          type: 'object',
          required: ['phaseNames', 'actorNames', 'sceneDescription', 'caption'],
          properties: {
            phaseNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Phase names this frame covers (must match blueprint phase names)',
            },
            actorNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Actor names appearing in this frame (must match blueprint actor names)',
            },
            sceneDescription: {
              type: 'string',
              description: 'Vivid scene description for image generation: setting, action, mood, composition, lighting',
            },
            caption: {
              type: 'string',
              description: 'Narrative caption for the frame (1-2 sentences, present tense, story voice)',
            },
          },
        },
      },
    },
  },
};
