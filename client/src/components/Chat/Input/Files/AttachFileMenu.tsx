import React, { useRef, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { FileUpload, TooltipAnchor, AttachmentIcon } from '@librechat/client';
import { EToolResources, EModelEndpoint } from 'librechat-data-provider';
import type { EndpointFileConfig, TConversation } from 'librechat-data-provider';
import type { ExtendedFile, FileSetter } from '~/common';
import { useFileHandlingNoChatContext, useLocalize } from '~/hooks';
import { ephemeralAgentByConvoId } from '~/store';
import { cn } from '~/utils';

/**
 * Lancya : un seul bouton "Joindre un fichier".
 * La destination est choisie automatiquement selon le type du fichier
 * (voir useFileHandling.handleFiles) : une image part au modele pour la vision,
 * un document (PDF, docx, txt...) part en recherche dans le fichier (RAG).
 * On evite ainsi de demander a l'utilisateur de choisir le bon mode a la main.
 */
const ACCEPT =
  'image/*,.heif,.heic,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.html';

interface AttachFileMenuProps {
  agentId?: string | null;
  endpoint?: string | null;
  disabled?: boolean | null;
  conversationId: string;
  endpointType?: EModelEndpoint | string;
  endpointFileConfig?: EndpointFileConfig;
  useResponsesApi?: boolean;
  files: Map<string, ExtendedFile>;
  setFiles: FileSetter;
  setFilesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  conversation: TConversation | null;
}

const AttachFileMenu = ({
  disabled,
  conversationId,
  files,
  setFiles,
  setFilesLoading,
  conversation,
}: AttachFileMenuProps) => {
  const localize = useLocalize();
  const isUploadDisabled = disabled ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setEphemeralAgent] = useRecoilState(ephemeralAgentByConvoId(conversationId));
  const { handleFileChange } = useFileHandlingNoChatContext(undefined, {
    files,
    setFiles,
    setFilesLoading,
    conversation,
  });

  const handleAttachClick = useCallback(() => {
    // On active la recherche dans les fichiers (RAG) pour cette conversation.
    // Sans effet si l'utilisateur n'envoie qu'une image (elle part en vision), donc sans risque.
    setEphemeralAgent((prev) => ({ ...prev, [EToolResources.file_search]: true }));
    if (!inputRef.current) {
      return;
    }
    inputRef.current.value = '';
    inputRef.current.accept = ACCEPT;
    inputRef.current.click();
  }, [setEphemeralAgent]);

  return (
    <FileUpload ref={inputRef} handleFileChange={(e) => handleFileChange(e)}>
      <TooltipAnchor
        id="attach-file-button"
        description={localize('com_sidepanel_attach_files')}
        disabled={isUploadDisabled}
        render={
          <button
            type="button"
            disabled={isUploadDisabled}
            aria-label="Attach File"
            onClick={handleAttachClick}
            className={cn(
              'flex size-9 items-center justify-center rounded-full p-1 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
            )}
          >
            <AttachmentIcon />
          </button>
        }
      />
    </FileUpload>
  );
};

export default React.memo(AttachFileMenu);
