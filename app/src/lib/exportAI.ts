/**
 * Exports a Blueprint as a compact Markdown file optimised for consumption
 * by AI tools. Designed to be token-efficient while preserving all structural
 * relationships.
 *
 * Structure:
 * - YAML-like front-matter for metadata
 * - Phases as top-level sections
 * - Actions as bullet items within actor groups, nested under phases
 * - Pain points, opportunities, and questions as sub-bullets on their actions
 * - Framework axis positions inlined on each item
 */

import type { Blueprint, FrameworkAxis } from '../types/blueprint';

export function exportBlueprintForAI(blueprint: Blueprint): string {
  const lines: string[] = [];
  const bp = blueprint;

  // ─── Header ─────────────────────────────────────────────────────────────
  lines.push(`# ${bp.name}`);
  lines.push('');
  lines.push('> Service blueprint exported for AI consumption.');
  lines.push('');

  // ─── Actors ─────────────────────────────────────────────────────────────
  const sortedActors = [...bp.actors].sort((a, b) => a.order - b.order);
  lines.push('## Actors');
  for (const actor of sortedActors) {
    let line = `- **${actor.name}**`;
    if (actor.bio) line += ` — ${actor.bio}`;
    lines.push(line);
    if (actor.goals) lines.push(`  - Goals: ${actor.goals}`);
  }
  lines.push('');

  // ─── Axes (if any) ──────────────────────────────────────────────────────
  const axes = bp.frameworkAxes ?? [];
  if (axes.length > 0) {
    lines.push('## Axes');
    for (const axis of axes) {
      lines.push(`- **${axis.title}** [${axis.lowLabel} → ${axis.highLabel}] (1–10 scale)`);
    }
    lines.push('');
  }

  // ─── Phases (main content) ──────────────────────────────────────────────
  const sortedPhases = [...bp.phases].sort((a, b) => a.order - b.order);
  lines.push('## Flow');
  lines.push('');

  for (const phase of sortedPhases) {
    let phaseHeader = `### ${phase.name}`;
    if (phase.conditional) phaseHeader += ' _(conditional)_';
    lines.push(phaseHeader);
    if (phase.description) lines.push(phase.description);
    lines.push('');

    // Group actions by actor within this phase
    const phaseActions = bp.actions
      .filter((a) => a.phaseId === phase.id)
      .sort((a, b) => a.order - b.order);

    for (const actor of sortedActors) {
      const actorActions = phaseActions.filter((a) => a.actorId === actor.id);
      if (actorActions.length === 0) continue;

      lines.push(`**${actor.name}:**`);
      for (const action of actorActions) {
        let actionLine = `- ${action.label}`;
        if (action.labelDetailed) actionLine += ` — ${action.labelDetailed}`;
        lines.push(actionLine);

        // Pain points
        const pains = bp.painPoints.filter((p) => action.painPointIds.includes(p.id));
        for (const pp of pains) {
          let ppLine = `  - ⚠️ Pain [${pp.severity}]: ${pp.description}`;
          ppLine += axisAnnotation(pp.id, axes);
          lines.push(ppLine);
        }

        // Opportunities
        const opps = bp.opportunities.filter((o) => action.opportunityIds.includes(o.id));
        for (const op of opps) {
          let opLine = `  - 💡 Opportunity: ${op.description}`;
          if (op.effort) opLine += ` [effort: ${op.effort}]`;
          opLine += axisAnnotation(op.id, axes);
          lines.push(opLine);
        }

        // Questions
        const questions = (bp.questions ?? []).filter((q) => (action.questionIds ?? []).includes(q.id));
        for (const q of questions) {
          let qLine = `  - ❓ Question: ${q.text}`;
          if (q.type) qLine += ` [${q.type}]`;
          qLine += axisAnnotation(q.id, axes);
          lines.push(qLine);
        }
      }
      lines.push('');
    }
  }

  // ─── Edges (custom relationships) ──────────────────────────────────────
  const customEdges = bp.customEdges ?? [];
  if (customEdges.length > 0) {
    lines.push('## Relationships');
    for (const edge of customEdges) {
      const src = bp.actions.find((a) => a.id === edge.sourceActionId);
      const tgt = bp.actions.find((a) => a.id === edge.targetActionId);
      if (!src || !tgt) continue;
      const meta = bp.edgeMeta?.[edge.id];
      const label = meta?.label ? ` "${meta.label}"` : '';
      const type = meta?.flowType ? ` (${meta.flowType})` : '';
      lines.push(`- ${src.label} →${label} ${tgt.label}${type}`);
    }
    lines.push('');
  }

  // ─── Frameworks summary ─────────────────────────────────────────────────
  const frameworks = bp.frameworks ?? [];
  if (frameworks.length > 0 && axes.length > 0) {
    lines.push('## Framework Combinations');
    for (const fw of frameworks) {
      const fwAxes = fw.axisIds.map((id) => axes.find((a) => a.id === id)?.title).filter(Boolean);
      lines.push(`- **${fw.name}** (${fw.mode}): ${fwAxes.join(' × ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Appends compact axis position annotations like ` {Impact:7, Effort:3}` */
function axisAnnotation(cardId: string, axes: FrameworkAxis[]): string {
  const positioned = axes
    .filter((a) => (a.cardPositions ?? {})[cardId] !== undefined)
    .map((a) => `${a.title}:${(a.cardPositions ?? {})[cardId]! + 1}`);
  if (positioned.length === 0) return '';
  return ` {${positioned.join(', ')}}`;
}
