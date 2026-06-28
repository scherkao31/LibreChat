import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { Check, FolderPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToastContext } from '@librechat/client';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { ChatContext } from '~/Providers';
import { cn } from '~/utils';

type Email = { subject: string; from?: string; date?: string; messageId?: string };

function parseEmails(raw: string): Email[] {
  try {
    const s = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    if (!s) {
      return [];
    }
    const data = JSON.parse(s);
    const arr = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : [];
    return arr
      .filter((e: Email) => e && typeof e.subject === 'string' && e.subject.trim())
      .map((e: Email) => ({
        subject: String(e.subject).trim(),
        from: typeof e.from === 'string' ? e.from.trim() : '',
        date: typeof e.date === 'string' ? e.date.trim() : '',
        messageId: typeof e.messageId === 'string' ? e.messageId.trim() : '',
      }));
  } catch {
    return []; // JSON incomplet (streaming) ou invalide : on n'affiche rien
  }
}

/**
 * EmailCards — rend un bloc `lancya_emails` (liste de mails) en carte Lancya. Chaque mail affiche
 * objet / expéditeur · date. Dans une conversation de dossier, un bouton « Attacher » suit le fil
 * dans le dossier (même effet que « suis cette discussion », dédup côté serveur par messageId).
 * Hors dossier : simple liste, pas de bouton. Robuste au streaming (rien tant que le JSON est partiel).
 */
const EmailCards = memo(function EmailCards({ raw }: { raw: string }) {
  const emails = useMemo(() => parseEmails(raw), [raw]);
  const chatContext = useContext(ChatContext);
  const chatProjectId = chatContext?.conversation?.chatProjectId ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const [attached, setAttached] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const handleAttach = useCallback(
    async (index: number, email: Email) => {
      if (!chatProjectId || attached[index] || busy[index]) {
        return;
      }
      setBusy((prev) => ({ ...prev, [index]: true }));
      try {
        const updated = await dataService.followProjectThread(chatProjectId, {
          subject: email.subject,
          from: email.from,
          messageId: email.messageId,
        });
        queryClient.setQueryData([QueryKeys.project, chatProjectId], updated);
        setAttached((prev) => ({ ...prev, [index]: true }));
        showToast({ message: 'Discussion suivie dans le dossier.', status: 'success' });
      } catch {
        showToast({ message: "L'ajout au dossier a échoué.", status: 'error' });
      } finally {
        setBusy((prev) => ({ ...prev, [index]: false }));
      }
    },
    [chatProjectId, attached, busy, queryClient, showToast],
  );

  if (emails.length === 0) {
    return null;
  }

  return (
    <div className="not-prose my-3 overflow-hidden rounded-2xl border border-border-light bg-surface-primary shadow-sm">
      {emails.map((email, index) => (
        <div
          key={`${index}-${email.messageId || email.subject}`}
          className={cn(
            'flex items-center gap-3 px-4 py-3',
            index < emails.length - 1 && 'border-b border-border-light',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-primary">{email.subject}</div>
            {(email.from || email.date) && (
              <div className="mt-0.5 truncate text-xs text-text-secondary">
                {[email.from, email.date].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          {chatProjectId != null &&
            (attached[index] ? (
              <span className="flex flex-shrink-0 items-center gap-1.5 px-1 text-xs text-green-600 dark:text-green-400">
                <Check size={15} aria-hidden="true" />
                Suivi dans le dossier
              </span>
            ) : (
              <button
                type="button"
                disabled={busy[index]}
                onClick={() => handleAttach(index, email)}
                className={cn(
                  'flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border-light px-2.5 py-1.5 text-xs text-text-secondary',
                  'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy disabled:opacity-50',
                )}
              >
                <FolderPlus size={15} aria-hidden="true" />
                Attacher
              </button>
            ))}
        </div>
      ))}
    </div>
  );
});

export default EmailCards;
