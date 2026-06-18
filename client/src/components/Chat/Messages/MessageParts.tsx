import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import type { TMessageContentParts } from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon } from '~/common';
import { useMessageHelpers, useLocalize, useAttachments, useContentMetadata } from '~/hooks';
import { cn, getHeaderPrefixForScreenReader, getMessageAriaLabel } from '~/utils';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import ContentParts from './Content/ContentParts';
import { fontSizeAtom } from '~/store/fontSize';
import SiblingSwitch from './SiblingSwitch';
import MultiMessage from './MultiMessage';
import HoverButtons from './HoverButtons';
import SubRow from './SubRow';
import store from '~/store';

export default function Message(props: TMessageProps) {
  const localize = useLocalize();
  const { message, siblingIdx, siblingCount, setSiblingIdx, currentEditId, setCurrentEditId } =
    props;
  const { attachments, searchResults } = useAttachments({
    messageId: message?.messageId,
    attachments: message?.attachments,
  });
  const {
    edit,
    index,
    agent,
    isLast,
    enterEdit,
    assistant,
    handleScroll,
    conversation,
    isSubmitting,
    latestMessageId,
    handleContinue,
    copyToClipboard,
    regenerateMessage,
  } = useMessageHelpers(props);

  const fontSize = useAtomValue(fontSizeAtom);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const { children, messageId = null, isCreatedByUser } = message ?? {};

  const name = useMemo(() => {
    let result = '';
    if (isCreatedByUser === true) {
      result = localize('com_user_message');
    } else if (assistant) {
      result = assistant.name ?? localize('com_ui_assistant');
    } else if (agent) {
      result = agent.name ?? localize('com_ui_agent');
    }

    return result;
  }, [assistant, agent, isCreatedByUser, localize]);

  const iconData: TMessageIcon = useMemo(
    () => ({
      endpoint: message?.endpoint ?? conversation?.endpoint,
      model: message?.model ?? conversation?.model,
      iconURL: message?.iconURL ?? conversation?.iconURL,
      modelLabel: name,
      isCreatedByUser: message?.isCreatedByUser,
    }),
    [
      name,
      conversation?.endpoint,
      conversation?.iconURL,
      conversation?.model,
      message?.model,
      message?.iconURL,
      message?.endpoint,
      message?.isCreatedByUser,
    ],
  );

  const { hasParallelContent } = useContentMetadata(message);

  /* En-tete IA (icone du modele + nom) masque dans la conversation, facon Claude :
   * l'icone du modele ne sert plus que dans le selecteur en haut. Repasser a true
   * pour reafficher le logo + le nom au-dessus des reponses de l'IA. */
  const showAiHeader = false;

  if (!message) {
    return null;
  }

  const getChatWidthClass = () => {
    if (maximizeChatSpace) {
      return 'w-full max-w-full md:px-5 lg:px-1 xl:px-5';
    }
    if (hasParallelContent) {
      return 'md:max-w-[58rem] xl:max-w-[70rem]';
    }
    return 'md:max-w-[47rem] xl:max-w-[55rem]';
  };

  const baseClasses = {
    common: 'group mx-auto flex flex-1 gap-3 transition-all duration-300 transform-gpu',
    chat: getChatWidthClass(),
  };

  return (
    <>
      <div
        className="w-full border-0 bg-transparent dark:border-0 dark:bg-transparent"
        onWheel={handleScroll}
        onTouchMove={handleScroll}
      >
        <div className="m-auto justify-center p-4 py-2 md:gap-6">
          <div
            id={messageId ?? ''}
            aria-label={getMessageAriaLabel(message, localize)}
            className={cn(
              baseClasses.common,
              baseClasses.chat,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy',
              'message-render',
              // Mes messages sont alignes a droite (style bulle, comme Claude).
              isCreatedByUser === true && 'justify-end',
            )}
          >
            {/* Avatar IA masque (showAiHeader=false) : plus d'icone dans la conversation. */}
            {showAiHeader && !hasParallelContent && isCreatedByUser !== true && (
              <div className="relative flex flex-shrink-0 flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full pt-0.5">
                  <MessageIcon iconData={iconData} assistant={assistant} agent={agent} />
                </div>
              </div>
            )}
            <div
              className={cn(
                'relative flex flex-col',
                isCreatedByUser === true
                  ? 'max-w-[85%]'
                  : hasParallelContent
                    ? 'w-full'
                    : 'w-11/12',
                isCreatedByUser ? 'user-turn items-end' : 'agent-turn',
              )}
            >
              {/* Nom IA masque (showAiHeader=false), comme l'avatar. */}
              {showAiHeader && !hasParallelContent && isCreatedByUser !== true && (
                <h2 className={cn('select-none font-semibold text-text-primary', fontSize)}>
                  <span className="sr-only">
                    {getHeaderPrefixForScreenReader(message, localize)}
                  </span>
                  {name}
                </h2>
              )}
              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    'flex min-h-[20px] max-w-full flex-grow flex-col gap-0',
                    // Bulle coloree pour mes messages (cote utilisateur).
                    isCreatedByUser === true && 'rounded-3xl bg-surface-tertiary px-4 py-2.5',
                  )}
                >
                  <ContentParts
                    edit={edit}
                    isLast={isLast}
                    enterEdit={enterEdit}
                    siblingIdx={siblingIdx}
                    attachments={attachments}
                    isSubmitting={isSubmitting}
                    searchResults={searchResults}
                    manualSkills={message.manualSkills}
                    messageId={message.messageId}
                    setSiblingIdx={setSiblingIdx}
                    isCreatedByUser={message.isCreatedByUser}
                    conversationId={conversation?.conversationId}
                    isLatestMessage={messageId === latestMessageId}
                    content={message.content as Array<TMessageContentParts | undefined>}
                  />
                </div>
                {isLast && isSubmitting ? (
                  <div className="mt-1 h-[31px] bg-transparent" />
                ) : (
                  <SubRow classes="text-xs">
                    <SiblingSwitch
                      siblingIdx={siblingIdx}
                      siblingCount={siblingCount}
                      setSiblingIdx={setSiblingIdx}
                    />
                    <HoverButtons
                      index={index}
                      isEditing={edit}
                      message={message}
                      enterEdit={enterEdit}
                      isSubmitting={isSubmitting}
                      conversation={conversation ?? null}
                      regenerate={() => regenerateMessage()}
                      copyToClipboard={copyToClipboard}
                      handleContinue={handleContinue}
                      latestMessageId={latestMessageId}
                      isLast={isLast}
                    />
                  </SubRow>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <MultiMessage
        messageId={messageId}
        conversation={conversation}
        messagesTree={children ?? []}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
      />
    </>
  );
}
