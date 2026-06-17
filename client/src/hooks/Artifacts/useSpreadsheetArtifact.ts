import { useEffect, useRef, useState } from 'react';
import { FileSources } from 'librechat-data-provider';
import { useFileDownload, useCodeOutputDownload } from '~/data-provider';
import { isHttpDownloadTarget } from '~/utils';
import { parseSpreadsheet } from '~/utils/spreadsheet';
import type { Artifact } from '~/common';
import type { WorkbookData } from '~/utils/spreadsheet';

/**
 * Files stored on the LibreChat server (vs. an external code-output URL).
 * Mirrors `isLocallyStoredSource` in `LogLink.tsx` so the grid fetches
 * the original binary through the SAME authenticated path the download
 * button already uses.
 */
const LOCAL_SOURCES: ReadonlyArray<string> = [
  FileSources.local,
  FileSources.firebase,
  FileSources.s3,
  FileSources.cloudfront,
  FileSources.azure_blob,
];

const isLocallyStoredSource = (source?: string): boolean =>
  source != null && LOCAL_SOURCES.includes(source as FileSources);

export type SpreadsheetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; workbook: WorkbookData }
  | { status: 'error' };

/**
 * Fetch the ORIGINAL spreadsheet binary referenced by an office artifact
 * and parse it (ExcelJS) into render-ready `WorkbookData`.
 *
 * The fetch reuses the existing authenticated download hooks
 * (`useFileDownload` for server-stored files, `useCodeOutputDownload`
 * for external code-output URLs) — both resolve to a URL string (a
 * `blob:` object URL, or a direct `https:` URL for S3/CloudFront direct
 * downloads). We `fetch()` that URL into an ArrayBuffer and hand it to
 * ExcelJS.
 *
 * On ANY failure (no file ref, fetch error, parse error) the state goes
 * to `error` and the caller falls back to the static HTML preview, so
 * nothing breaks.
 */
export function useSpreadsheetArtifact(artifact: Artifact): SpreadsheetState {
  const [state, setState] = useState<SpreadsheetState>({ status: 'idle' });

  const source = artifact.fileSource;
  const fileId = artifact.fileId;
  const user = artifact.fileUser;
  const href = artifact.filepath ?? '';

  const useLocalDownload = isLocallyStoredSource(source) && !!fileId && !!user;
  const { refetch: downloadFromApi } = useFileDownload(user, fileId, { source });
  const { refetch: downloadFromUrl } = useCodeOutputDownload(href);

  /* Re-fetch only when the underlying file identity changes — not on
   * every render. Keyed by the artifact id (stable per file). */
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
        // No usable reference to the original binary — bail to fallback.
        if (!useLocalDownload && !isHttpDownloadTarget(href)) {
          throw new Error('No fetchable file reference on artifact');
        }

        const result = useLocalDownload ? await downloadFromApi() : await downloadFromUrl();
        const url = result.data;
        if (typeof url !== 'string' || url.length === 0) {
          throw new Error('Download returned no URL');
        }

        /* Fetch the resolved URL (a `blob:` object URL, or a direct
         * `https:` URL for S3/CloudFront) into an ArrayBuffer. We do NOT
         * revoke the URL here: it's owned by the React Query cache and
         * shared with the download button's refetch — revoking it could
         * invalidate that cached entry. The existing app never revokes
         * these either; the lifecycle is identical to today's behavior. */
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
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
