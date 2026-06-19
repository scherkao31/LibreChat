const express = require('express');
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

  try {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    // Page paysage 16:9 (13.333 x 7.5 pouces = 1280x720 a 96 dpi), marges nulles,
    // fonds imprimes. Le HTML coupe une page par slide (page-break-after).
    form.append('paperWidth', '13.333');
    form.append('paperHeight', '7.5');
    form.append('marginTop', '0');
    form.append('marginBottom', '0');
    form.append('marginLeft', '0');
    form.append('marginRight', '0');
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

module.exports = router;
