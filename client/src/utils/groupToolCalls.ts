import { Constants, ContentTypes, ToolCallTypes } from 'librechat-data-provider';
import type { TMessageContentParts, Agents } from 'librechat-data-provider';
import type { PartWithIndex } from '~/components/Chat/Messages/Content/ParallelContent';

export type GroupedPart =
  | { type: 'single'; part: PartWithIndex }
  | { type: 'tool-group'; parts: PartWithIndex[] };

function isGroupableToolCall(part: TMessageContentParts): boolean {
  if (part.type !== ContentTypes.TOOL_CALL) {
    return false;
  }
  const toolCall = part[ContentTypes.TOOL_CALL] as Agents.ToolCall | undefined;
  if (!toolCall) {
    return false;
  }
  const isStandardToolCall =
    'args' in toolCall && (!toolCall.type || toolCall.type === ToolCallTypes.TOOL_CALL);
  if (isStandardToolCall && toolCall.name?.startsWith(Constants.LC_TRANSFER_TO_)) {
    return false;
  }
  return true;
}

/**
 * Les blocs de raisonnement ("Pensées") sont eux aussi groupables, AU MEME TITRE
 * que les appels d'outils. Sans ca, une sequence reflexion -> outil -> reflexion ->
 * outil n'etait jamais regroupee (les outils n'etaient pas consecutifs), d'ou
 * l'empilement de plusieurs en-tetes "Pensées" + "Ran X". En les rendant groupables,
 * toute la sequence "reflexion + etapes" se replie sous UN SEUL en-tete (facon Claude),
 * tandis que la reponse finale (un part TEXT, non groupable) reste toujours visible.
 */
function isReasoningPart(part: TMessageContentParts): boolean {
  return part.type === ContentTypes.THINK;
}

function isGroupablePart(part: TMessageContentParts): boolean {
  return isGroupableToolCall(part) || isReasoningPart(part);
}

export function groupSequentialToolCalls(parts: PartWithIndex[]): GroupedPart[] {
  const result: GroupedPart[] = [];
  let currentGroup: PartWithIndex[] = [];

  const flushGroup = () => {
    if (currentGroup.length >= 2) {
      result.push({ type: 'tool-group', parts: [...currentGroup] });
    } else {
      for (const p of currentGroup) {
        result.push({ type: 'single', part: p });
      }
    }
    currentGroup = [];
  };

  for (const item of parts) {
    if (isGroupablePart(item.part)) {
      currentGroup.push(item);
    } else {
      flushGroup();
      result.push({ type: 'single', part: item });
    }
  }
  flushGroup();

  return result;
}
