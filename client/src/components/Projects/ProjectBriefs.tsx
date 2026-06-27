import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, Copy, Check, FileText, Save } from 'lucide-react';
import { OGDialog, OGDialogTemplate, Button, useToastContext } from '@librechat/client';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { TChatProject, TChatProjectBrief } from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

/**
 * Section « Points » du dossier : le bouton « Faire le point » genere un debrief de l'etat
 * du dossier (fiche + documents), qu'on relit dans une fenetre, qu'on peut copier et
 * SAUVEGARDER. Les points sauvegardes restent listes ici, horodates, et se rouvrent au clic.
 * Le « point du matin », mais a la demande, avec son historique.
 */

function formatDate(iso?: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
}

function preview(text: string): string {
  const line =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#')) ?? '';
  return line.replace(/[*_`#>[\]()]/g, '').slice(0, 110);
}

export default function ProjectBriefs({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const briefs = project.briefs ?? [];
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Le point affiche : son texte, et s'il est deja sauvegarde (historique) ou tout frais.
  const [current, setCurrent] = useState<{ text: string; persisted: boolean }>({
    text: '',
    persisted: true,
  });

  const generate = async () => {
    if (generating) {
      return;
    }
    setGenerating(true);
    try {
      const { brief } = await dataService.getProjectBrief(projectId);
      setCurrent({ text: brief, persisted: false });
      setOpen(true);
    } catch {
      showToast({
        message: "Le point n'a pas pu être généré. Réessaie dans un instant.",
        status: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (saving || current.persisted) {
      return;
    }
    setSaving(true);
    try {
      const updated = await dataService.saveProjectBrief(projectId, current.text);
      queryClient.setQueryData([QueryKeys.project, projectId], updated);
      setCurrent((c) => ({ ...c, persisted: true }));
      showToast({ message: 'Point enregistré dans le dossier.', status: 'success' });
    } catch {
      showToast({ message: "L'enregistrement a échoué. Réessaie.", status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openSaved = (brief: TChatProjectBrief) => {
    setCurrent({ text: brief.text, persisted: true });
    setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible : on ignore */
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-border-light bg-surface-secondary p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Points
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={14} aria-hidden="true" />
          )}
          {generating ? 'Je fais le point...' : 'Faire le point'}
        </button>
      </div>

      {briefs.length === 0 && !generating ? (
        <p className="px-1 py-1 text-sm text-text-secondary">
          Aucun point pour l'instant. « Faire le point » crée une synthèse de l'état du dossier (à
          partir de la fiche et des documents), que tu peux relire, copier et garder ici.
        </p>
      ) : (
        <div className="flex flex-col">
          {briefs.map((brief) => (
            <button
              key={brief.id}
              type="button"
              onClick={() => openSaved(brief)}
              className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-tertiary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary">
                <FileText size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text-primary">
                  Point du {formatDate(brief.createdAt)}
                </div>
                {preview(brief.text) ? (
                  <div className="truncate text-[11px] text-text-tertiary">{preview(brief.text)}</div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTemplate
          title="Le point sur le dossier"
          showCloseButton={true}
          className="w-11/12 max-w-2xl bg-surface-primary text-text-primary"
          main={
            <div className="markdown prose dark:prose-invert max-h-[70vh] w-full max-w-none overflow-y-auto break-words pr-1 text-text-primary">
              <MarkdownLite content={current.text} codeExecution={false} />
            </div>
          }
          buttons={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={copy}
                aria-label="Copier le point"
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied ? 'Copié' : 'Copier'}
              </Button>
              {!current.persisted && (
                <Button
                  type="button"
                  variant="submit"
                  onClick={save}
                  disabled={saving}
                  aria-label="Sauvegarder le point dans le dossier"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Sauvegarder
                </Button>
              )}
            </>
          }
        />
      </OGDialog>
    </section>
  );
}
