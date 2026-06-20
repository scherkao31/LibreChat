import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * Bouton d'export avec sous-options : quand il y a plusieurs slides/cartes, un clic
 * ouvre un petit menu "Celle-ci / Tout". Quand il n'y en a qu'une, le clic exporte
 * directement. Partage par les widgets slides et carrousel.
 */
type Props = {
  icon: ReactNode;
  label: string;
  loading?: boolean;
  multiple: boolean;
  currentLabel: string;
  onAll: () => void;
  onCurrent: () => void;
};

export default function ExportMenu({
  icon,
  label,
  loading,
  multiple,
  currentLabel,
  onAll,
  onCurrent,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const btnClass = cn(
    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
    'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
    loading && 'cursor-not-allowed opacity-50',
  );

  if (!multiple) {
    return (
      <button type="button" onClick={onAll} disabled={loading} className={btnClass}>
        {icon}
        {loading ? `${label}...` : label}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={btnClass}
      >
        {icon}
        {loading ? `${label}...` : label}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-1 min-w-[150px] overflow-hidden rounded-lg border border-border-medium bg-surface-primary py-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCurrent();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface-tertiary"
          >
            {currentLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAll();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface-tertiary"
          >
            Tout
          </button>
        </div>
      )}
    </div>
  );
}
