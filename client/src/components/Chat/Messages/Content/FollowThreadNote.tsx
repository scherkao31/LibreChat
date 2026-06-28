import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { ChatContext } from '~/Providers';

type Thread = { subject: string; from?: string; messageId?: string; note?: string };

function parseThread(raw: string): Thread | null {
  try {
    const s = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    if (!s) {
      return null;
    }
    const data = JSON.parse(s);
    const subject = typeof data?.subject === 'string' ? data.subject.trim() : '';
    if (!subject) {
      return null;
    }
    return {
      subject,
      from: typeof data?.from === 'string' ? data.from.trim() : '',
      messageId: typeof data?.messageId === 'string' ? data.messageId.trim() : '',
      note: typeof data?.note === 'string' ? data.note.trim() : '',
    };
  } catch {
    return null; // bloc incomplet (streaming) ou JSON invalide : on n'affiche rien
  }
}

/**
 * FollowThreadNote — rend un bloc `lancya_follow_thread` que l'IA émet quand l'utilisateur lui
 * demande de SUIVRE une discussion email dans le dossier. Enregistre le fil suivi côté Lancya (pas
 * dans la boîte) une seule fois et le confirme visuellement. Le contexte est lu via useContext (ne
 * jette pas) : hors d'une conversation de projet, on n'enregistre rien.
 */
const FollowThreadNote = memo(function FollowThreadNote({ raw }: { raw: string }) {
  const thread = useMemo(() => parseThread(raw), [raw]);
  const chatContext = useContext(ChatContext);
  const chatProjectId = chatContext?.conversation?.chatProjectId ?? null;
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !chatProjectId || !thread) {
      return;
    }
    savedRef.current = true;
    dataService
      .followProjectThread(chatProjectId, thread)
      .then((updated) => {
        queryClient.setQueryData([QueryKeys.project, chatProjectId], updated);
        setSaved(true);
      })
      .catch(() => {
        savedRef.current = false; // autorise un nouvel essai au prochain rendu
      });
  }, [chatProjectId, thread, queryClient]);

  if (!thread) {
    return null;
  }

  return (
    <div className="not-prose my-2 flex flex-col gap-1.5 rounded-xl border border-border-medium bg-surface-secondary px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {saved ? (
          <Check size={14} className="text-green-600 dark:text-green-400" aria-hidden="true" />
        ) : (
          <Mail size={14} aria-hidden="true" />
        )}
        {saved ? 'Discussion suivie dans le dossier' : 'Ajout au suivi...'}
      </div>
      <div className="text-sm text-text-primary">
        {thread.subject}
        {thread.from ? <span className="text-text-tertiary"> · avec {thread.from}</span> : null}
      </div>
    </div>
  );
});

export default FollowThreadNote;
