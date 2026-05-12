import { supabase } from './supabase';
import type { Blueprint, Actor, Phase, Action, Touchpoint, PainPoint, Opportunity, Question } from '../types/blueprint';

const SYSTEM_PROMPT = `You are a service design expert. Given input (a transcript, description, or document), extract a structured service blueprint.

A service blueprint maps how a service works across multiple actors (people, systems, organizations) through phases (major stages of the journey).

Your job:
1. Identify distinct ACTORS — who or what participates (e.g. "Customer", "Support Agent", "Backend System")
2. Identify PHASES — major stages of the service journey (3-7 phases typical)
3. Map each step or interaction as an ACTION owned by one actor in one phase
   - At most one action per actor per phase. If an actor has multiple steps in a phase, pick the most representative one.
4. Extract PAIN POINTS — friction, failures, or problems experienced
5. Extract TOUCHPOINTS — interfaces, channels, or systems involved (app screen, phone call, email, etc.)
6. Suggest OPPORTUNITIES — improvements or ideas surfaced by the input
7. Capture QUESTIONS — open questions, unknowns, or things worth investigating about the service

Be specific. Use short, clear labels. Don't be exhaustive — prioritize what matters.`;

type OnStatus = (message: string) => void;

export async function generateBlueprint(
  input: string,
  onStatus: OnStatus
): Promise<Blueprint> {
  onStatus('Analyzing your input...');

  const { data, error } = await supabase.functions.invoke('ai-generate', {
    body: {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [blueprintTool],
      tool_choice: { type: 'any' },
      messages: [
        {
          role: 'user',
          content: `Please analyze this and generate a service blueprint:\n\n${input}`,
        },
      ],
    },
  });

  if (error) throw new Error(`Blueprint generation failed: ${error.message}`);

  onStatus('Building blueprint...');

  const content = (data as { content: Array<{ type: string; input?: unknown }> }).content;
  const toolUse = content.find((b) => b.type === 'tool_use');
  if (!toolUse) {
    throw new Error('No blueprint was generated. Please try again.');
  }

  const raw = toolUse.input as RawBlueprint;
  return normalizeBlueprintResponse(raw);
}

type RawActor = { name: string; color?: string };
type RawPhase = { name: string };
type RawAction = {
  actorName: string;
  phaseName: string;
  label: string;
  labelDetailed?: string;
  labelAbstract?: string;
  touchpoints?: string[];
  painPoints?: string[];
  opportunities?: string[];
  questions?: string[];
};
type RawTouchpoint = { label: string; type?: string };
type RawPainPoint = { description: string; actorName?: string; phaseName?: string; severity?: string };
type RawOpportunity = { description: string };
type RawQuestion = { text: string };

type RawBlueprint = {
  name: string;
  actors: RawActor[];
  phases: RawPhase[];
  actions: RawAction[];
  touchpoints?: RawTouchpoint[];
  painPoints?: RawPainPoint[];
  opportunities?: RawOpportunity[];
  questions?: RawQuestion[];
};

const ACTOR_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
];

function normalizeBlueprintResponse(raw: RawBlueprint): Blueprint {
  const now = new Date().toISOString();
  const id = `bp-${Date.now()}`;

  const actors: Actor[] = (raw.actors ?? []).map((a, i) => ({
    id: `actor-${i}`,
    name: a.name,
    color: a.color ?? ACTOR_COLORS[i % ACTOR_COLORS.length],
    order: i,
  }));

  const phases: Phase[] = (raw.phases ?? []).map((p, i) => ({
    id: `phase-${i}`,
    name: p.name,
    order: i,
  }));

  const actorByName = new Map(actors.map((a) => [a.name.toLowerCase(), a]));
  const phaseByName = new Map(phases.map((p) => [p.name.toLowerCase(), p]));

  const touchpoints: Touchpoint[] = (raw.touchpoints ?? []).map((t, i) => ({
    id: `tp-${i}`,
    label: t.label,
    type: (t.type as Touchpoint['type']) ?? 'interface',
  }));

  const painPoints: PainPoint[] = (raw.painPoints ?? []).map((pp, i) => ({
    id: `pp-${i}`,
    description: pp.description,
    severity: (pp.severity as PainPoint['severity']) ?? 'medium',
    actionIds: [],
    aiGenerated: true,
  }));

  const opportunities: Opportunity[] = (raw.opportunities ?? []).map((o, i) => ({
    id: `opp-${i}`,
    description: o.description,
    actionIds: [],
    painPointIds: [],
    aiGenerated: true,
  }));

  const questions: Question[] = (raw.questions ?? []).map((q, i) => ({
    id: `q-${i}`,
    text: q.text,
    actionIds: [],
    aiGenerated: true,
  }));

  const tpByLabel = new Map(touchpoints.map((t) => [t.label.toLowerCase(), t]));
  const ppByDesc = new Map(painPoints.map((p) => [p.description.toLowerCase(), p]));
  const oppByDesc = new Map(opportunities.map((o) => [o.description.toLowerCase(), o]));
  const qByText = new Map(questions.map((q) => [q.text.toLowerCase(), q]));

  const actionCountPerCell = new Map<string, number>();

  const actions: Action[] = (raw.actions ?? []).flatMap((a, i) => {
    const actor = actorByName.get(a.actorName?.toLowerCase());
    const phase = phaseByName.get(a.phaseName?.toLowerCase());
    if (!actor || !phase) return [];

    const cellKey = `${actor.id}:${phase.id}`;
    const order = actionCountPerCell.get(cellKey) ?? 0;
    actionCountPerCell.set(cellKey, order + 1);

    const touchpointIds = (a.touchpoints ?? [])
      .map((label) => tpByLabel.get(label.toLowerCase())?.id)
      .filter(Boolean) as string[];

    const painPointIds = (a.painPoints ?? [])
      .map((desc) => ppByDesc.get(desc.toLowerCase())?.id)
      .filter(Boolean) as string[];

    const opportunityIds = (a.opportunities ?? [])
      .map((desc) => oppByDesc.get(desc.toLowerCase())?.id)
      .filter(Boolean) as string[];

    const questionIds = (a.questions ?? [])
      .map((text) => qByText.get(text.toLowerCase())?.id)
      .filter(Boolean) as string[];

    // Link items back to this action
    painPointIds.forEach((ppId) => {
      const pp = painPoints.find((p) => p.id === ppId);
      if (pp && !pp.actionIds.includes(`action-${i}`)) pp.actionIds.push(`action-${i}`);
    });
    opportunityIds.forEach((oppId) => {
      const opp = opportunities.find((o) => o.id === oppId);
      if (opp && !opp.actionIds.includes(`action-${i}`)) opp.actionIds.push(`action-${i}`);
    });
    questionIds.forEach((qId) => {
      const q = questions.find((q) => q.id === qId);
      if (q && !q.actionIds.includes(`action-${i}`)) q.actionIds.push(`action-${i}`);
    });

    return [{
      id: `action-${i}`,
      actorId: actor.id,
      phaseId: phase.id,
      label: a.label,
      labelDetailed: a.labelDetailed,
      labelAbstract: a.labelAbstract,
      touchpointIds,
      painPointIds,
      opportunityIds,
      questionIds,
      order,
    }];
  });

  return {
    id,
    name: raw.name ?? 'Untitled Blueprint',
    actors,
    phases,
    actions,
    touchpoints,
    painPoints,
    opportunities,
    questions,
    createdAt: now,
    updatedAt: now,
  };
}

const blueprintTool = {
  name: 'create_blueprint',
  description: 'Generate a structured service blueprint from the provided input',
  input_schema: {
    type: 'object' as const,
    required: ['name', 'actors', 'phases', 'actions'],
    properties: {
      name: { type: 'string', description: 'Short descriptive name for this service/journey' },
      actors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['actorName', 'phaseName', 'label'],
          properties: {
            actorName: { type: 'string', description: 'Must match an actor name exactly' },
            phaseName: { type: 'string', description: 'Must match a phase name exactly' },
            label: { type: 'string', description: 'Short action label (action level detail)' },
            labelDetailed: { type: 'string', description: 'Longer micro-detail description' },
            labelAbstract: { type: 'string', description: 'One-word or short abstract label' },
            touchpoints: { type: 'array', items: { type: 'string' }, description: 'Touchpoint labels that apply' },
            painPoints: { type: 'array', items: { type: 'string' }, description: 'Pain point descriptions that apply to this specific step' },
            opportunities: { type: 'array', items: { type: 'string' }, description: 'Opportunity descriptions that apply to this specific step' },
            questions: { type: 'array', items: { type: 'string' }, description: 'Open question texts that apply to this specific step' },
          },
        },
      },
      touchpoints: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label'],
          properties: {
            label: { type: 'string' },
            type: { type: 'string', enum: ['interface', 'system', 'human'] },
          },
        },
      },
      painPoints: {
        type: 'array',
        items: {
          type: 'object',
          required: ['description'],
          properties: {
            description: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      opportunities: {
        type: 'array',
        items: {
          type: 'object',
          required: ['description'],
          properties: { description: { type: 'string' } },
        },
      },
      questions: {
        type: 'array',
        description: 'Open questions, unknowns, or things worth investigating about the service',
        items: {
          type: 'object',
          required: ['text'],
          properties: { text: { type: 'string', description: 'The open question' } },
        },
      },
    },
  },
};
