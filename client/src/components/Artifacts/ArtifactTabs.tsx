import { useRef, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { editor } from 'monaco-editor';
import type { Artifact } from '~/common';
import { useCodeState } from '~/Providers/EditorContext';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { TOOL_ARTIFACT_TYPES } from '~/utils/artifacts';
import { ArtifactCodeEditor } from './ArtifactCodeEditor';
import { useGetStartupConfig } from '~/data-provider';
import { ArtifactPreview } from './ArtifactPreview';
import SpreadsheetArtifact from './SpreadsheetArtifact';

export default function ArtifactTabs({
  artifact,
  previewRef,
  isSharedConvo,
}: {
  artifact: Artifact;
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
  isSharedConvo?: boolean;
}) {
  const { currentCode, setCurrentCode } = useCodeState();
  const { data: startupConfig } = useGetStartupConfig();
  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (artifact.id !== lastIdRef.current) {
      setCurrentCode(undefined);
    }
    lastIdRef.current = artifact.id;
  }, [setCurrentCode, artifact.id]);

  const { files, fileKey, template, sharedProps } = useArtifactProps({ artifact });

  /* Spreadsheet artifacts get an interactive read-only grid (parsed from
   * the ORIGINAL .xlsx via ExcelJS) instead of the static HTML iframe.
   * The grid component fetches/parses the original file and falls back to
   * the HTML preview (`ArtifactPreview`) on any failure. docx/pptx are
   * unaffected and keep the Sandpack iframe path. */
  const isSpreadsheet = artifact.type === TOOL_ARTIFACT_TYPES.SPREADSHEET;

  return (
    <div className="flex h-full w-full flex-col">
      <Tabs.Content
        value="code"
        id="artifacts-code"
        className="h-full w-full flex-grow overflow-auto"
        tabIndex={-1}
      >
        <ArtifactCodeEditor artifact={artifact} monacoRef={monacoRef} readOnly={isSharedConvo} />
      </Tabs.Content>

      <Tabs.Content
        value="preview"
        className="h-full w-full flex-grow overflow-hidden"
        tabIndex={-1}
      >
        {isSpreadsheet ? (
          <SpreadsheetArtifact
            artifact={artifact}
            files={files}
            fileKey={fileKey}
            template={template}
            previewRef={previewRef}
            sharedProps={sharedProps}
            startupConfig={startupConfig}
          />
        ) : (
          <ArtifactPreview
            files={files}
            fileKey={fileKey}
            template={template}
            previewRef={previewRef}
            sharedProps={sharedProps}
            currentCode={currentCode}
            startupConfig={startupConfig}
          />
        )}
      </Tabs.Content>
    </div>
  );
}
