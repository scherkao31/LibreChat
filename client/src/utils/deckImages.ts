import axios from 'axios';

/**
 * Decoupe un deck/carrousel HTML propre en UNE page HTML autonome par carte
 * (`.slide`), chacune dimensionnee pour w x h pixels (statique, plein cadre, sans
 * navigation). Sert a generer un PNG par carte cote serveur (Gotenberg screenshot).
 */
export function buildPerSlideHtmls(cleanHtml: string, w: number, h: number): string[] {
  const docu = new DOMParser().parseFromString(cleanHtml, 'text/html');
  const headInner = docu.head?.innerHTML ?? '';
  const slides = Array.from(docu.querySelectorAll('.slide'));
  const force = `<style>html,body{margin:0;padding:0}.slide{position:static !important;width:${w}px !important;height:${h}px !important;margin:0 !important;transform:none !important;opacity:1 !important;overflow:hidden;box-sizing:border-box}</style>`;
  return slides.map(
    (s) => `<!DOCTYPE html><html><head>${headInner}${force}</head><body>${s.outerHTML}</body></html>`,
  );
}

/** Renvoie le HTML propre du deck en ne gardant QUE la slide a l'index donne. */
export function filterToSlideHtml(cleanHtml: string, index: number): string {
  const docu = new DOMParser().parseFromString(cleanHtml, 'text/html');
  const slides = Array.from(docu.querySelectorAll('.slide'));
  slides.forEach((s, i) => {
    if (i !== index) {
      s.remove();
    }
  });
  return `<!DOCTYPE html>\n${docu.documentElement.outerHTML}`;
}

/**
 * Envoie des pages HTML (une par carte) au serveur, qui renvoie un PNG (si une seule
 * carte) ou un ZIP (plusieurs), et telecharge le resultat avec la bonne extension.
 * Renvoie false s'il n'y a aucune carte ; lance en cas d'erreur reseau.
 */
export async function downloadImagesFromHtmls(
  perSlideHtmls: string[],
  w: number,
  h: number,
  baseName: string,
): Promise<boolean> {
  if (perSlideHtmls.length === 0) {
    return false;
  }
  const resp = await axios.post(
    '/api/deck/images',
    { slides: perSlideHtmls, width: w, height: h },
    { responseType: 'arraybuffer' },
  );
  const ct = String(resp.headers?.['content-type'] || '');
  const isPng = ct.includes('image/png');
  const blob = new Blob([resp.data], { type: isPng ? 'image/png' : 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.${isPng ? 'png' : 'zip'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Compat : exporte TOUTES les cartes d'un deck propre (zip), comme avant. */
export async function downloadDeckImages(
  cleanHtml: string,
  w: number,
  h: number,
  filename: string,
): Promise<boolean> {
  return downloadImagesFromHtmls(buildPerSlideHtmls(cleanHtml, w, h), w, h, filename.replace(/\.zip$/, ''));
}
