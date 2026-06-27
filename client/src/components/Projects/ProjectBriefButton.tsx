import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { OGDialog, OGDialogTemplate, Button, useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

/**
 * « Faire le point » : un bouton qui demande au serveur un debrief de l'etat du dossier
 * (a partir de la fiche validee et des documents) et l'affiche comme un document a lire,
 * copier (et plus tard ranger dans le dossier). Le « point du matin », mais a la demande.
 */
export default function ProjectBriefButton({ projectId }: { projectId: string }) {
  const { showToast } = useToastContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const { brief: text } = await dataService.getProjectBrief(projectId);
      setBrief(text);
      setOpen(true);
    } catch {
      showToast({
        message: "Le point n'a pas pu être généré. Réessaie dans un instant.",
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible : on ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-border-medium bg-surface-secondary px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
        {loading ? 'Je fais le point...' : 'Faire le point'}
      </button>

      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTemplate
          title="Le point sur le dossier"
          showCloseButton={true}
          className="w-11/12 max-w-2xl bg-surface-primary text-text-primary"
          main={
            <div className="max-h-[70vh] overflow-y-auto pr-1 text-sm leading-relaxed text-text-primary">
              <MarkdownLite content={brief} codeExecution={false} />
            </div>
          }
          buttons={
            <Button type="button" variant="submit" onClick={copy} aria-label="Copier le point">
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
    </>
  );
}
