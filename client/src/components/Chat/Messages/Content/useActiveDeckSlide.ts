import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Suit la slide/carte actuellement affichee dans un widget deck (SlideDeck,
 * CarouselViewer). Le script injecte dans l'iframe poste, a chaque changement,
 * un message { lancyaDeckSlide: true, index, count }. Ce hook l'ecoute (en
 * filtrant sur l'iframe concernee) et renvoie l'index courant + le nombre total.
 */
export function useActiveDeckSlide(iframeRef: RefObject<HTMLIFrameElement>): {
  index: number;
  count: number;
} {
  const [state, setState] = useState<{ index: number; count: number }>({ index: 0, count: 1 });

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { lancyaDeckSlide?: boolean; index?: number; count?: number } | null;
      if (!d || d.lancyaDeckSlide !== true) {
        return;
      }
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) {
        return;
      }
      setState({
        index: Number.isFinite(d.index) ? Number(d.index) : 0,
        count: Number.isFinite(d.count) && Number(d.count) > 0 ? Number(d.count) : 1,
      });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [iframeRef]);

  return state;
}
