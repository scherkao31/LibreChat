import { useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Trash2, Loader2 } from 'lucide-react';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { TChatProject, TFile } from 'librechat-data-provider';
import {
  useGetFiles,
  useGetEndpointsQuery,
  useUploadFileMutation,
  useDeleteFilesMutation,
  useUpdateProjectMutation,
} from '~/data-provider';

/**
 * ProjectDocuments — la base documentaire d'un projet (dossier vivant). On depose des
 * fichiers au fil du temps ; ils sont stockes et indexes (RAG) en reutilisant le pipeline
 * d'upload existant (comme une piece jointe de conversation, tool_resource file_search),
 * puis rattaches au projet (project.fileIds). Toutes les conversations du projet pourront
 * les interroger A LA DEMANDE (grounding via file_search, increment suivant), et l'ajout
 * d'un document declenchera son analyse vers la fiche.
 */

function formatSize(bytes?: number): string {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} o`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ProjectDocuments({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const fileIds = useMemo(() => project.fileIds ?? [], [project.fileIds]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: endpointsConfig } = useGetEndpointsQuery();
  const endpoint = useMemo(() => Object.keys(endpointsConfig ?? {})[0] ?? '', [endpointsConfig]);

  const { data: allFiles } = useGetFiles<TFile[]>();
  const docs = useMemo(
    () => (Array.isArray(allFiles) ? allFiles.filter((f) => fileIds.includes(f.file_id)) : []),
    [allFiles, fileIds],
  );

  const updateProject = useUpdateProjectMutation();
  const queryClient = useQueryClient();

  const uploadMutation = useUploadFileMutation({
    onSuccess: async (data) => {
      if (!data?.file_id) {
        return;
      }
      try {
        // Rattache le document au projet ET declenche son analyse vers la fiche.
        const updated = await dataService.addProjectDocument(projectId, data.file_id);
        queryClient.setQueryData([QueryKeys.project, projectId], updated);
        queryClient.invalidateQueries([QueryKeys.files]);
      } catch {
        // Repli : au minimum rattacher le document (sans analyse).
        updateProject.mutate({ projectId, fileIds: [...fileIds, data.file_id] });
      }
    },
  });

  const deleteMutation = useDeleteFilesMutation({
    onSuccess: (_data, vars) => {
      const removed = new Set(vars.files.map((f) => f.file_id));
      updateProject.mutate({ projectId, fileIds: fileIds.filter((id) => !removed.has(id)) });
    },
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const formData = new FormData();
      formData.append('endpoint', endpoint);
      formData.append('endpointType', '');
      formData.append('file', file, encodeURIComponent(file.name));
      formData.append('file_id', uuidv4());
      formData.append('message_file', 'true');
      formData.append('tool_resource', 'file_search');
      uploadMutation.mutate(formData);
    });
    e.target.value = '';
  };

  const onDelete = (file: TFile) => {
    deleteMutation.mutate({ files: [file] });
  };

  const uploading = uploadMutation.isLoading;

  return (
    <section className="mt-4 rounded-2xl border border-border-light bg-surface-secondary p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Documents
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !endpoint}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Ajouter
        </button>
        <input ref={inputRef} type="file" multiple onChange={onPick} className="hidden" />
      </div>

      {docs.length === 0 && !uploading ? (
        <p className="px-1 py-1 text-sm text-text-secondary">
          Déposez les documents du projet (PDF, Word, Excel...). L'IA les analysera pour la fiche et
          pourra s'y référer dans toutes les conversations du projet.
        </p>
      ) : (
        <div className="flex flex-col">
          {docs.map((file) => (
            <div
              key={file.file_id}
              className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-tertiary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary">
                <FileText size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text-primary">{file.filename}</div>
                <div className="text-[11px] text-text-tertiary">
                  {formatSize(file.bytes)}
                  {file.embedded === false ? ' · indexation...' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(file)}
                title="Retirer du projet"
                className="shrink-0 rounded-md p-1 text-text-tertiary opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {uploading ? (
            <div className="flex items-center gap-3 px-2 py-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Téléversement...
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
