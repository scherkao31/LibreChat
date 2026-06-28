import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, BookmarkPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { ChatContext } from '~/Providers';

const SECTION_LABELS: Record<string, string> = {
  decision: 'Décision',
  deadline: 'Échéance',
  open: 'Point ouvert',
  action: 'Action',
  info: 'À retenir',
};

type Item = { section?: string; text: string };

function parseItems(raw: string): Item[] | null {
  try {
    const s = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    if (!s) {
      return null;
    }
    const data = JSON.parse(s);
    const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [data];
    const items = arr.filter((it: Item) => it && typeof it.text === 'string' && it.text.trim());
    return items.length > 0 ? items : null;
  } catch {
    return null; // bloc incomplet (streaming) ou JSON invalide : on n'affiche rien
  }
}

/**
 * FicheNote — rend un bloc `lancya_fiche` que l'IA émet quand l'utilisateur lui demande de
 * « retenir » quelque chose dans le dossier. Range l'élément dans la fiche du projet (une
 * seule fois ; dédup côté serveur pour les re-rendus) et le confirme visuellement. Le contexte
 * est lu via useContext (ne jette pas) : hors d'une conversation de projet, on n'enregistre rien.
 */
const FicheNote = memo(function FicheNote({ raw }: { raw: string }) {
  const items = useMemo(() => parseItems(raw), [raw]);
  const chatContext = useContext(ChatContext);
  const chatProjectId = chatContext?.conversation?.chatProjectId ?? null;
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !chatProjectId || !items) {
      return;
    }
    savedRef.current = true;
    dataService
      .addProjectFicheItems(chatProjectId, items)
      .then((updated) => {
        queryClient.setQueryData([QueryKeys.project, chatProjectId], updated);
        setSaved(true);
      })
      .catch(() => {
        savedRef.current = false; // autorise un nouvel essai au prochain rendu
      });
  }, [chatProjectId, items, queryClient]);

  if (!items) {
    return null;
  }

  return (
    <div className="not-prose my-2 flex flex-col gap-1.5 rounded-xl border border-border-medium bg-surface-secondary px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {saved ? (
          <Check size={14} className="text-green-600 dark:text-green-400" aria-hidden="true" />
        ) : (
          <BookmarkPlus size={14} aria-hidden="true" />
        )}
        {saved ? 'Noté dans la fiche du dossier' : 'Ajout à la fiche...'}
      </div>
      {items.map((item, index) => (
        <div key={index} className="text-sm text-text-primary">
          <span className="text-text-tertiary">
            {SECTION_LABELS[item.section ?? 'info'] ?? 'À retenir'} :{' '}
          </span>
          {item.text}
        </div>
      ))}
    </div>
  );
});

export default FicheNote;
