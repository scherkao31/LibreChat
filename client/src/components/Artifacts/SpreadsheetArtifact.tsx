import React, { memo, type MutableRefObject } from 'react';
import { Spinner } from '@librechat/client';
import type {
  SandpackPreviewRef,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react/unstyled';
import type { TStartupConfig } from 'librechat-data-provider';
import type { Artifact, ArtifactFiles } from '~/common';
import { useSpreadsheetArtifact } from '~/hooks/Artifacts/useSpreadsheetArtifact';
import { ArtifactPreview } from './ArtifactPreview';
import SpreadsheetGrid from './SpreadsheetGrid';

/**
 * Spreadsheet artifact preview.
 *
 * Attempts to fetch + parse the ORIGINAL `.xlsx`/`.xls`/`.ods` with
 * ExcelJS and render an interactive read-only grid (formula bar, sticky
 * headers, cell selection, styles, merges, sheet tabs). While loading it
 * shows a spinner; on ANY failure (no file ref, fetch error, parse
 * error) it falls back to the existing server-rendered static HTML
 * preview (Sandpack iframe) so nothing breaks.
 *
 * Keeps the docx/pptx preview path completely untouched — only the
 * spreadsheet bucket routes here.
 */
function SpreadsheetArtifact({
  artifact,
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  startupConfig,
}: {
  artifact: Artifact;
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: MutableRefObject<SandpackPreviewRef>;
  startupConfig?: TStartupConfig;
}) {
  const state = useSpreadsheetArtifact(artifact);

  /* Fallback to the static HTML preview when we couldn't fetch/parse the
   * original binary (e.g. CSV with no rich source, missing file ref, an
   * ExcelJS parse error, or an offline blob URL). */
  const htmlFallback = (
    <ArtifactPreview
      files={files}
      fileKey={fileKey}
      template={template}
      previewRef={previewRef}
      sharedProps={sharedProps}
      startupConfig={startupConfig}
    />
  );

  if (state.status === 'ready') {
    return <SpreadsheetGrid workbook={state.workbook} />;
  }

  if (state.status === 'error') {
    return htmlFallback;
  }

  /* idle / loading — show a spinner. Mounting the HTML fallback here too
   * would double-fetch and flash the iframe; the spinner is cheap and the
   * parse is fast for typical artifacts. */
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-primary">
      <Spinner className="text-text-secondary" />
    </div>
  );
}

export default memo(SpreadsheetArtifact);
