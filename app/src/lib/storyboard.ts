import { supabase } from './supabase';
import { getPreset } from './styleLibrary';
import type { StylePresetId } from './styleLibrary';
import type { Blueprint, Actor, StoryboardStyleGuide, StoryboardFrame } from '../types/blueprint';

// ─── Universal blocks (appended to every prompt) ──────────────────────────────

const UNIVERSAL_CONTINUITY = `Maintain visual continuity across all storyboard frames. The same named character must retain the same age, facial structure, hairstyle, body type, skin tone, clothing, accessories, and recognizable silhouette in every image. The visual style, color palette, lighting logic, level of detail, and environment design language must remain consistent across the full journey map. The image should show one clear service moment with readable body language and an uncluttered composition suitable for journey-map storyboarding.`;

const UNIVERSAL_OUTPUT = `Create a single storyboard frame for a service journey map. The image should be horizontally oriented, presentation-ready, clean, readable at small sizes, and leave some open space for labels or annotations. Do not include text, captions, speech bubbles, logos, watermarks, UI text, brand marks, or written words inside the image unless explicitly requested.`;

// ─── Style guide generation ───────────────────────────────────────────────────

export async function generateStyleGuide(
  blueprint: Blueprint,
  stylePresetId: string
): Promise<StoryboardStyleGuide> {
  const preset = getPreset(stylePresetId);

  const actorList = blueprint.actors
    .sort((a, b) => a.order - b.order)
    .map((a) => `- ${a.name}${a.bio ? `: ${a.bio}` : ''}${a.goals ? ` (goals: ${a.goals})` : ''}`)
    .join('\n');

  const { data, error } = await supabase.functions.invoke('ai-storyboard', {
    body: {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a character designer for a storyboard. Given a list of actors from a service blueprint, create vivid, specific visual character descriptions that will produce consistent illustrations when used in image generation prompts.

Each description must be 1–2 sentences covering: approximate age, gender, hair (color + style), skin tone, key clothing/outfit, distinctive features, and typical expression/body language. Write in a style optimized for image generation prompts (descriptive phrases, not full sentences).

Visual style context: ${preset.name} — ${preset.description}
Character rendering guidance: ${preset.characterPrompt}`,
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

  if (error || !data) return { baseStyle: stylePresetId, characterDescriptions: {} };

  const content = (data as { content: Array<{ type: string; input?: unknown }> }).content;
  const toolUse = content.find((b) => b.type === 'tool_use');
  if (!toolUse) return { baseStyle: stylePresetId, characterDescriptions: {} };

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

  // baseStyle now stores the preset ID (e.g. 'editorial-illustration')
  return { baseStyle: stylePresetId, characterDescriptions };
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
      system: `You are a service design researcher writing scene descriptions for a journey map storyboard. Given a service blueprint, create storyboard frames that describe each service moment clearly and humanly.

WRITING STYLE:
- Write like a thoughtful product researcher describing a real customer moment
- Be human but not sentimental. Acknowledge motivation, uncertainty, or relief only when the step supports it.
- Be specific but not overly detailed. Use concrete actions from the blueprint. Do not invent emotional backstory.
- Be calm but not dry. More readable than a process step, but credible and professional.
- Be observational, not cinematic. Describe what the customer and service team are doing. Avoid movie-trailer language, sweeping metaphors, or "big moment" framing.

CAPTION RULES (1–2 sentences, present tense, third person):
- Use plain natural language: "The customer submits the form and waits for confirmation."
- Connect customer and staff actions: "Once the request comes in, staff review the details and prepare a response."
- Use moderate emotional language only when it helps explain the experience: "The customer may feel more confident once they understand what information is needed."

AVOID in captions:
- Heightened emotion: hearts racing, full of hope, dream becomes reality, life-changing moment
- Cinematic phrasing: across the lobby, behind the scenes, the stage is set, a new chapter unfolds
- Vague inspirational endings: the first step toward something magical, the beginning of an unforgettable experience
- Assumed feelings: the customer feels overwhelmed with joy, staff are excited to help

SCENE DESCRIPTION RULES (for image generation):
- Describe the physical moment: who is present, what they are doing, the setting, and key objects/touchpoints
- Include an environment description (location, lighting, atmosphere)
- Keep it grounded — describe observable actions, not inner feelings
- The scene description should work as a clear image prompt showing one specific service moment

STRUCTURE:
- Create one frame per phase (combine minor phases if needed)
- Frames should flow as a coherent sequence showing the service journey`,
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
      environmentDescription?: string;
      caption: string;
    }>;
  };

  const actorByName = new Map(blueprint.actors.map((a) => [a.name.toLowerCase(), a]));
  const phaseByName = new Map(blueprint.phases.map((p) => [p.name.toLowerCase(), p]));

  return (raw.frames ?? []).map((f) => ({
    sceneDescription: f.sceneDescription,
    environmentDescription: f.environmentDescription,
    caption: f.caption,
    phaseIds: (f.phaseNames ?? []).map((n) => phaseByName.get(n.toLowerCase())?.id).filter(Boolean) as string[],
    actorIds: (f.actorNames ?? []).map((n) => actorByName.get(n.toLowerCase())?.id).filter(Boolean) as string[],
    imageUrl: undefined,
  }));
}

// ─── Image prompt construction (structured format from style doc) ─────────────

export function buildImagePrompt(
  frame: Pick<StoryboardFrame, 'sceneDescription' | 'actorIds'>,
  styleGuide: StoryboardStyleGuide,
  actors: Actor[]
): string {
  const preset = getPreset(styleGuide.baseStyle as StylePresetId);

  // Build character descriptions
  const primaryChars = frame.actorIds
    .map((id) => {
      const actor = actors.find((a) => a.id === id);
      const desc = styleGuide.characterDescriptions[id];
      if (!actor) return null;
      if (desc) return `${actor.name} (${desc}). ${actor.name} should retain the same identity, hairstyle, clothing, body type, and recognizable silhouette in every storyboard frame.`;
      return `${actor.name}`;
    })
    .filter(Boolean) as string[];

  const parts = [
    // 1. Master style prompt
    preset.masterPrompt,
    '',
    // 2. Scene description
    `Scene:\n${frame.sceneDescription}`,
    '',
    // 3. Primary character(s)
    ...(primaryChars.length
      ? [`Primary Character:\n${primaryChars[0]}`, '']
      : []),
    ...(primaryChars.length > 1
      ? [`Supporting Characters:\n${primaryChars.slice(1).join('\n')}`, '']
      : []),
    // 4. Composition
    `Composition:\n${preset.compositionPrompt}`,
    '',
    // 5. Continuity
    `Continuity Requirements:\n${UNIVERSAL_CONTINUITY}`,
    '',
    // 6. Output requirements
    `Output Requirements:\n${UNIVERSAL_OUTPUT}`,
    '',
    // 7. Negative constraints
    preset.negativePrompt,
  ];

  return parts.join('\n');
}

// ─── Image generation (Nano Banana via Edge Function → Supabase Storage) ─────

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

  const result = data as { url: string | null; error?: string };
  if (result.error) {
    console.error('Image generation error:', result.error);
  }

  return result.url ?? null;
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
              description: 'Grounded scene description for image generation: who is present, what they are doing, the setting, key objects/touchpoints. Describe observable actions, not inner feelings.',
            },
            environmentDescription: {
              type: 'string',
              description: 'The location and setting: physical space, key props, atmosphere',
            },
            caption: {
              type: 'string',
              description: 'Clear, grounded caption (1-2 sentences, present tense, third person). Describe the service action plainly. Avoid cinematic or inspirational language.',
            },
          },
        },
      },
    },
  },
};
