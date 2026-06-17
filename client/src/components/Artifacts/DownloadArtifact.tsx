import React, { useState } from 'react';
import { Download, CircleCheckBig } from 'lucide-react';
import type { Artifact } from '~/common';
import { Button } from '@librechat/client';
import { isPreviewOnlyArtifact } from '~/utils/artifacts';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useAttachmentLink } from '~/components/Chat/Messages/Content/Parts/LogLink';
import { useCodeState } from '~/Providers/EditorContext';
import { useLocalize } from '~/hooks';

const DownloadArtifact = ({ artifact }: { artifact: Artifact }) => {
  const localize = useLocalize();
  const { currentCode } = useCodeState();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const { fileKey: fileName } = useArtifactProps({ artifact });

  /* Artefacts « office » (DOCX / tableur / présentation) : le panneau
   * affiche du HTML d'aperçu généré côté serveur, mais le téléchargement
   * doit récupérer le VRAI fichier d'origine (.xlsx/.docx/.pptx) — pas
   * `artifact.content` (le HTML). On réutilise EXACTEMENT le même chemin
   * authentifié que la « puce » de pièce jointe (`useAttachmentLink`),
   * via la référence de fichier embarquée sur l'artefact par
   * `fileToArtifact`. Les autres types (code/markdown/mermaid) gardent le
   * téléchargement blob de leur contenu, ci-dessous. */
  const isOfficeArtifact = isPreviewOnlyArtifact(artifact.type) && artifact.filepath != null;
  const { handleDownload: handleOriginalFileDownload } = useAttachmentLink({
    href: artifact.filepath ?? '',
    filename: artifact.title ?? fileName,
    file_id: artifact.fileId,
    user: artifact.fileUser,
    source: artifact.fileSource,
  });

  const handleBlobDownload = () => {
    try {
      const content = currentCode ?? artifact.content ?? '';
      if (!content) {
        return;
      }
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 3000);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleClick = async (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    if (isOfficeArtifact) {
      await handleOriginalFileDownload(event);
      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 3000);
      return;
    }
    handleBlobDownload();
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-9 w-9"
      onClick={handleClick}
      aria-label={localize('com_ui_download_artifact')}
    >
      {isDownloaded ? (
        <CircleCheckBig size={16} aria-hidden="true" />
      ) : (
        <Download size={16} aria-hidden="true" />
      )}
    </Button>
  );
};

export default DownloadArtifact;
