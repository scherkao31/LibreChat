import { useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useQueryClient } from '@tanstack/react-query';
import { useToastContext } from '@librechat/client';
import { Plus, FileText, Trash2, Loader2, AlertCircle } from 'lucide-react';
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
 * ProjectDocuments — base documentaire du projet. On depose des fichiers (reutilise
 * l'upload + RAG existant), ils sont rattaches au projet et ANALYSES vers la fiche
 * (endpoint POST /documents). On montre chaque phase en direct (televersement -> analyse
 * en cours -> termine/echec) pour que l'utilisateur sache ce qui se passe.
 */

type Pending = { key: string; name: string; phase: 'upload' | 'analyse' | 'error' };

/** Dimensions d'une image (le serveur d'upload les attend pour les fichiers image). */
function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

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
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const [pending, setPending] = useState<Pending[]>([]);

  const { data: endpointsConfig } = useGetEndpointsQuery();
  const endpoint = useMemo(() => Object.keys(endpointsConfig ?? {})[0] ?? '', [endpointsConfig]);

  const { data: allFiles } = useGetFiles<TFile[]>();
  const docs = useMemo(
    () => (Array.isArray(allFiles) ? allFiles.filter((f) => fileIds.includes(f.file_id)) : []),
    [allFiles, fileIds],
  );

  const updateProject = useUpdateProjectMutation();
  const uploadMutation = useUploadFileMutation();
  const setPhase = (key: string, phase: Pending['phase']) =>
    setPending((p) => p.map((x) => (x.key === key ? { ...x, phase } : x)));
  const drop = (key: string) => setPending((p) => p.filter((x) => x.key !== key));

  const deleteMutation = useDeleteFilesMutation({
    onSuccess: (_data, vars) => {
      const removed = new Set(vars.files.map((f) => f.file_id));
      updateProject.mutate({ projectId, fileIds: fileIds.filter((id) => !removed.has(id)) });
    },
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      const key = uuidv4();
      setPending((p) => [...p, { key, name: file.name, phase: 'upload' }]);
      try {
        const isImage = file.type.startsWith('image/');
        const formData = new FormData();
        formData.append('endpoint', endpoint);
        formData.append('endpointType', '');
        formData.append('file', file, encodeURIComponent(file.name));
        formData.append('file_id', uuidv4());
        formData.append('message_file', 'true');
        // Image : on envoie ses dimensions (comme le chat) et pas de file_search ; le modele la
        // lit en vision pour la fiche. Document : file_search (extraction de texte).
        if (isImage) {
          const size = await readImageSize(file);
          if (size) {
            formData.append('width', String(size.width));
            formData.append('height', String(size.height));
          }
        } else {
          formData.append('tool_resource', 'file_search');
        }
        const uploaded = await uploadMutation.mutateAsync(formData);

        // Phase analyse : le serveur rattache le doc ET l'analyse vers la fiche.
        setPhase(key, 'analyse');
        const before = project.fiche?.items?.length ?? 0;
        const updated = await dataService.addProjectDocument(projectId, uploaded.file_id);
        queryClient.setQueryData([QueryKeys.project, projectId], updated);
        queryClient.invalidateQueries([QueryKeys.files]);
        drop(key);

        const after = updated.fiche?.items?.length ?? 0;
        if (after <= before) {
          showToast({
            message: `« ${file.name} » ajouté, mais l'analyse n'a rien pu en extraire pour la fiche.`,
            status: 'warning',
          });
        }
      } catch {
        setPhase(key, 'error');
        setTimeout(() => drop(key), 6000);
        showToast({ message: `Échec de l'ajout de « ${file.name} ».`, status: 'error' });
      }
    }
  };

  const onDelete = (file: TFile) => {
    deleteMutation.mutate({ files: [file] });
  };

  const busy = pending.length > 0;
  const isEmpty = docs.length === 0 && !busy;

  return (
    <section className="mt-4 rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Documents
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!endpoint}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          Ajouter
        </button>
        <input ref={inputRef} type="file" multiple onChange={onPick} className="hidden" />
      </div>

      {isEmpty ? (
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
                <div className="text-[11px] text-text-tertiary">{formatSize(file.bytes)}</div>
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

          {pending.map((p) => (
            <div key={p.key} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary ${
                  p.phase === 'error' ? 'text-red-500' : 'text-text-secondary'
                }`}
              >
                {p.phase === 'error' ? (
                  <AlertCircle size={16} />
                ) : (
                  <Loader2 size={16} className="animate-spin" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text-primary">{p.name}</div>
                <div className="text-[11px] text-text-tertiary">
                  {p.phase === 'upload'
                    ? 'Téléversement...'
                    : p.phase === 'analyse'
                      ? 'Analyse en cours...'
                      : "Échec de l'ajout"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
