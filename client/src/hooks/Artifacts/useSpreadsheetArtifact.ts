import { useEffect, useRef, useState } from 'react';
import { dataService } from 'librechat-data-provider';
import { parseSpreadsheet } from '~/utils/spreadsheet';
import type { Artifact } from '~/common';
import type { WorkbookData } from '~/utils/spreadsheet';

export type SpreadsheetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; workbook: WorkbookData }
  | { status: 'error' };

/**
 * Recupere le .xlsx d'origine d'un artefact tableur et le parse (ExcelJS) en
 * `WorkbookData` pret a afficher dans la grille interactive.
 *
 * IMPORTANT (CORS) : on NE telecharge PAS l'URL S3 presignee directement
 * (le stockage Infomaniak ne renvoie pas d'en-tete Access-Control-Allow-Origin,
 * donc un `fetch()` cross-origin est bloque). On passe par `getFileDownload`,
 * qui appelle l'endpoint serveur /api/files/download/:userId/:file_id en mode
 * blob : le serveur lit le fichier sur S3 et le renvoie en MEME ORIGINE +
 * authentifie. Plus de probleme de CORS, aucun reglage Infomaniak requis.
 *
 * Sur toute erreur (pas de reference fichier, telechargement KO, parse KO) on
 * passe en `error` et l'appelant retombe sur l'apercu HTML/PDF — aucune regression.
 */
export function useSpreadsheetArtifact(artifact: Artifact): SpreadsheetState {
  const [state, setState] = useState<SpreadsheetState>({ status: 'idle' });

  const fileId = artifact.fileId;
  const user = artifact.fileUser;

  /* Re-fetch uniquement quand le fichier change (cle = id de l'artefact). */
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = artifact.id;
    if (lastKeyRef.current === key) {
      return;
    }
    lastKeyRef.current = key;

    let cancelled = false;

    const run = async () => {
      setState({ status: 'loading' });
      try {
        if (!fileId || !user) {
          throw new Error('No file reference on artifact');
        }

        /* Telechargement SERVEUR (meme-origine, authentifie) -> aucun CORS. */
        const response = await dataService.getFileDownload(user, fileId);
        const blob = response.data as Blob;
        const buffer = await blob.arrayBuffer();
        const workbook = await parseSpreadsheet(buffer);
        if (!cancelled) {
          setState({ status: 'ready', workbook });
        }
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn('[spreadsheet-artifact] falling back to HTML preview:', error);
          setState({ status: 'error' });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id]);

  return state;
}
