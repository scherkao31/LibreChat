import type { TConversation } from 'librechat-data-provider';

/**
 * Nettoie un titre de conversation pour l'AFFICHAGE (pas pour le stockage) :
 * les titres auto-generes arrivent parfois avec du markdown (**gras**, *italique*,
 * `code`) ou entoures de guillemets, ce qui fait desordre dans la barre laterale.
 * On retire ces decorations sans toucher au titre reel (le renommage reste intact).
 */
export function cleanConversationTitle(title?: string | null): string {
  if (!title) {
    return '';
  }
  let t = title.trim();
  // Guillemets droits ou typographiques enveloppants
  t = t.replace(/^["'“”«»\s]+/, '').replace(/["'“”«»\s]+$/, '');
  // Emphase markdown ** __ * _ et backticks (en debut/fin ou tout autour)
  t = t.replace(/^\**\s*/, '').replace(/\s*\**$/, '');
  t = t.replace(/[*_`]/g, '');
  // Titres markdown (# ) en tete
  t = t.replace(/^#+\s*/, '');
  return t.trim();
}

export type ConversationRenderProps = {
  conversation: TConversation;
  isGenerating?: boolean;
};

export function areConversationIconFieldsEqual(
  prevConversation: TConversation,
  nextConversation: TConversation,
) {
  return (
    prevConversation.endpoint === nextConversation.endpoint &&
    prevConversation.endpointType === nextConversation.endpointType &&
    prevConversation.iconURL === nextConversation.iconURL &&
    prevConversation.model === nextConversation.model &&
    prevConversation.modelLabel === nextConversation.modelLabel &&
    prevConversation.chatGptLabel === nextConversation.chatGptLabel &&
    prevConversation.spec === nextConversation.spec &&
    prevConversation.agent_id === nextConversation.agent_id &&
    prevConversation.assistant_id === nextConversation.assistant_id
  );
}

export function areConversationListItemFieldsEqual(
  prevConversation: TConversation,
  nextConversation: TConversation,
) {
  return (
    areConversationIconFieldsEqual(prevConversation, nextConversation) &&
    prevConversation.conversationId === nextConversation.conversationId &&
    prevConversation.title === nextConversation.title &&
    prevConversation.chatProjectId === nextConversation.chatProjectId &&
    prevConversation.createdAt === nextConversation.createdAt &&
    prevConversation.updatedAt === nextConversation.updatedAt
  );
}

export function areConversationRenderPropsEqual(
  prevProps: ConversationRenderProps,
  nextProps: ConversationRenderProps,
) {
  return (
    areConversationListItemFieldsEqual(prevProps.conversation, nextProps.conversation) &&
    prevProps.isGenerating === nextProps.isGenerating
  );
}
