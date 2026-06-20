const express = require('express');
const JSZip = require('jszip');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
router.use(requireJwtAuth);

/**
 * POST /api/deck/pdf
 *
 * Convertit le HTML d'une presentation (widget lancya_deck) en PDF haute fidelite
 * via Gotenberg (Chromium auto-heberge, souverain). Le client envoie { html } ;
 * on relaie a Gotenberg et on renvoie le PDF en telechargement direct.
 *
 * Pas de dependance ajoutee : fetch / FormData / Blob natifs (Node 18+).
 * GOTENBERG_URL = URL du service Gotenberg (sur Railway, reseau prive interne :
 * http://<nom-du-service>.railway.internal:3000). Si la variable n'est pas
 * configuree, l'endpoint renvoie 503 (le bouton PDF reste sans effet, pas de crash).
 */
router.post('/pdf', async (req, res) => {
  const gotenbergUrl = process.env.GOTENBERG_URL;
  if (!gotenbergUrl) {
    return res
      .status(503)
      .json({ error: 'Service PDF non configure (GOTENBERG_URL manquant).' });
  }

  const html = req.body?.html;
  if (typeof html !== 'string' || html.trim().length === 0) {
    return res.status(400).json({ error: 'HTML manquant.' });
  }

  // Taille de page parametrable (en pouces) avec validation numerique stricte.
  // Defauts = slides paysage 16:9 (13.333 x 7.5, marges 0) pour rester compatible.
  // Un document envoie du A4 portrait (8.27 x 11.69) avec une marge.
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? String(n) : def;
  };
  const paperWidth = num(req.body?.paperWidth, '13.333');
  const paperHeight = num(req.body?.paperHeight, '7.5');
  const margin = num(req.body?.margin, '0');

  try {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('paperWidth', paperWidth);
    form.append('paperHeight', paperHeight);
    form.append('marginTop', margin);
    form.append('marginBottom', margin);
    form.append('marginLeft', margin);
    form.append('marginRight', margin);
    form.append('printBackground', 'true');

    const upstream = await fetch(
      `${gotenbergUrl.replace(/\/+$/, '')}/forms/chromium/convert/html`,
      { method: 'POST', body: form },
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      logger.error(`[deck/pdf] Gotenberg ${upstream.status}: ${detail.slice(0, 300)}`);
      return res.status(502).json({ error: 'La conversion PDF a echoue.' });
    }

    const pdf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="presentation.pdf"');
    return res.status(200).send(pdf);
  } catch (error) {
    logger.error('[deck/pdf] error', error);
    return res.status(500).json({ error: 'Erreur lors de la conversion PDF.' });
  }
});

/**
 * POST /api/deck/images
 *
 * Exporte chaque carte/slide en PNG via Gotenberg (screenshot Chromium) et renvoie
 * un ZIP. Le client envoie { slides: [html, ...], width, height } ou chaque html est
 * une carte isolee, dimensionnee pour width x height pixels. Sert surtout aux
 * carrousels Instagram (1080x1350) et aux slides (1280x720).
 */
router.post('/images', async (req, res) => {
  const gotenbergUrl = process.env.GOTENBERG_URL;
  if (!gotenbergUrl) {
    return res.status(503).json({ error: 'Service image non configure (GOTENBERG_URL manquant).' });
  }

  const slides = req.body?.slides;
  if (!Array.isArray(slides) || slides.length === 0 || slides.length > 40) {
    return res.status(400).json({ error: 'Liste de cartes invalide.' });
  }

  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= 5000 ? Math.round(n) : def;
  };
  const width = num(req.body?.width, 1080);
  const height = num(req.body?.height, 1350);
  const base = gotenbergUrl.replace(/\/+$/, '');

  try {
    const zip = new JSZip();
    for (let i = 0; i < slides.length; i++) {
      const html = slides[i];
      if (typeof html !== 'string' || html.length === 0) {
        continue;
      }
      const form = new FormData();
      form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
      form.append('width', String(width));
      form.append('height', String(height));
      form.append('format', 'png');
      const shot = await fetch(`${base}/forms/chromium/screenshot/html`, {
        method: 'POST',
        body: form,
      });
      if (!shot.ok) {
        const detail = await shot.text().catch(() => '');
        logger.error(`[deck/images] Gotenberg ${shot.status}: ${detail.slice(0, 200)}`);
        return res.status(502).json({ error: "La generation d'images a echoue." });
      }
      const buf = Buffer.from(await shot.arrayBuffer());
      zip.file(`carte-${String(i + 1).padStart(2, '0')}.png`, buf);
    }
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="images.zip"');
    return res.status(200).send(zipBuf);
  } catch (error) {
    logger.error('[deck/images] error', error);
    return res.status(500).json({ error: "Erreur lors de la generation d'images." });
  }
});

module.exports = router;
