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

/**
 * Demande au serveur un PNG par carte (via Gotenberg), recoit un ZIP et le
 * telecharge. Renvoie false s'il n'y a aucune carte. Lance en cas d'erreur reseau.
 */
export async function downloadDeckImages(
  cleanHtml: string,
  w: number,
  h: number,
  filename: string,
): Promise<boolean> {
  const slides = buildPerSlideHtmls(cleanHtml, w, h);
  if (slides.length === 0) {
    return false;
  }
  const resp = await axios.post(
    '/api/deck/images',
    { slides, width: w, height: h },
    { responseType: 'arraybuffer' },
  );
  const blob = new Blob([resp.data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
