import { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';
import { OGDialog, OGDialogTemplate, Button } from '@librechat/client';
import type { TChatProject, TChatProjectDeliverable } from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

/**
 * Section « Livrables » du dossier : les contenus rangés depuis les discussions (via le bouton
 * « Ajouter au dossier » sur une réponse de l'IA). On les relit ici et on les copie. La section
 * n'apparaît que s'il y a au moins un livrable (sinon, rien à montrer).
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

export default function ProjectDeliverables({ project }: { project: TChatProject }) {
  const deliverables = project.deliverables ?? [];
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<TChatProjectDeliverable | null>(null);
  const [copied, setCopied] = useState(false);

  if (deliverables.length === 0) {
    return null;
  }

  const view = (deliverable: TChatProjectDeliverable) => {
    setCurrent(deliverable);
    setOpen(true);
  };

  const copy = async () => {
    if (!current) {
      return;
    }
    try {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible : on ignore */
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm">
      <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-text-secondary">
        Livrables
      </h2>
      <div className="flex flex-col">
        {deliverables.map((deliverable) => (
          <button
            key={deliverable.id}
            type="button"
            onClick={() => view(deliverable)}
            className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-tertiary"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary">
              <FileText size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text-primary">
                {deliverable.title || 'Livrable'}
              </div>
              <div className="truncate text-[11px] text-text-tertiary">
                Ajouté le {formatDate(deliverable.createdAt)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTemplate
          title={current?.title || 'Livrable'}
          showCloseButton={true}
          className="w-11/12 max-w-2xl bg-surface-primary text-text-primary"
          main={
            <div className="markdown prose dark:prose-invert max-h-[70vh] w-full max-w-none overflow-y-auto break-words pr-1 text-text-primary">
              <MarkdownLite content={current?.content ?? ''} codeExecution={false} />
            </div>
          }
          buttons={
            <Button type="button" variant="outline" onClick={copy} aria-label="Copier le livrable">
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          }
        />
      </OGDialog>
    </section>
  );
}
