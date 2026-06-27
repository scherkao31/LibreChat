const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const { logger } = require('@librechat/data-schemas');
const { createProjectHandlers, generateShortLivedToken, logAxiosError } = require('@librechat/api');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const db = require('~/models');

const router = express.Router();
const handlers = createProjectHandlers({
  listChatProjects: db.listChatProjects,
  createChatProject: db.createChatProject,
  getChatProject: db.getChatProject,
  updateChatProject: db.updateChatProject,
  deleteChatProject: db.deleteChatProject,
  assignConversationToProject: db.assignConversationToProject,
});

const FICHE_SECTIONS = ['decision', 'deadline', 'open', 'action', 'info'];

/** Extrait un objet JSON d'une reponse LLM (tolerant aux ``` et au texte de raisonnement). */
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  let s = text.trim();
  // Retire les blocs de raisonnement et les fences markdown.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Essai direct (cas du mode JSON force).
  try {
    return JSON.parse(s);
  } catch {
    /* on tente une extraction par blocs */
  }
  // Premier bloc { ... } equilibre.
  const start = s.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') {
      depth++;
    } else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  // Dernier recours : du premier { au dernier }.
  const end = s.lastIndexOf('}');
  if (end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Appel LLM Lancya, sur l'endpoint Infomaniak DEJA configure (INFOMANIAK_API_KEY + PRODUCT_ID).
 * Renvoie le texte de la reponse, ou '' si non configure / echec. Ne jette jamais. Gere le
 * modele raisonnant (Kimi) : assez de jetons, et repli sur reasoning_content si content est vide.
 */
async function callLancyaModel({ system, user, maxTokens = 2000, temperature = 0.3 }) {
  const apiKey = process.env.INFOMANIAK_API_KEY;
  const productId = process.env.PRODUCT_ID;
  const model = process.env.FICHE_ANALYSIS_MODEL || 'moonshotai/Kimi-K2.6';
  if (!apiKey || !productId) {
    logger.warn('[projects] LLM : config absente (INFOMANIAK_API_KEY / PRODUCT_ID)');
    return '';
  }
  const baseURL =
    process.env.FICHE_ANALYSIS_BASE_URL || `https://api.infomaniak.com/2/ai/${productId}/openai/v1`;
  try {
    const resp = await fetch(`${baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!resp.ok) {
      logger.warn(`[projects] LLM : statut ${resp.status}`);
      return '';
    }
    const data = await resp.json();
    const choice = data?.choices?.[0] ?? {};
    return choice.message?.content || choice.message?.reasoning_content || '';
  } catch (err) {
    logger.warn(`[projects] LLM : appel echoue (${err.message})`);
    return '';
  }
}

/**
 * Recupere le TEXTE d'un document, comme le chat le fait : si le texte est deja stocke
 * (petits fichiers texte) on le prend, sinon on telecharge le fichier (S3/local...) et on
 * l'envoie a l'API RAG `/text` qui l'extrait (meme mecanisme que parseText). Renvoie '' si
 * indisponible. Ne jette jamais.
 */
async function getDocumentText({ req, file }) {
  if (typeof file?.text === 'string' && file.text.trim()) {
    return file.text;
  }
  if (!process.env.RAG_API_URL || !file?.source) {
    return '';
  }
  try {
    const { getDownloadStream } = getStrategyFunctions(file.source);
    if (!getDownloadStream) {
      return '';
    }
    const fileStream = await getDownloadStream(req, file.storageKey || file.filepath);
    const form = new FormData();
    form.append('file_id', file.file_id);
    form.append('file', fileStream, file.filename || file.file_id);
    const jwtToken = generateShortLivedToken(req.user.id);
    const resp = await axios.post(`${process.env.RAG_API_URL}/text`, form, {
      headers: { Authorization: `Bearer ${jwtToken}`, accept: 'application/json', ...form.getHeaders() },
      timeout: 120000,
      maxBodyLength: Infinity,
    });
    return typeof resp.data?.text === 'string' ? resp.data.text : '';
  } catch (err) {
    logAxiosError({ error: err, message: '[projects] extraction texte (RAG /text) echouee' });
    return '';
  }
}

/**
 * Analyse un document et propose des elements pour la fiche du projet. BEST-EFFORT :
 * renvoie null si l'analyse n'est pas configuree (variables d'env) ou echoue, sans jamais
 * bloquer l'ajout du document. Appel LLM direct vers un endpoint OpenAI-compatible dedie
 * (FICHE_ANALYSIS_BASE_URL / _API_KEY / _MODEL), decouple du chat.
 */
async function analyzeDocumentToFiche({ req, project, file }) {
  // Reutilise la config Infomaniak DEJA en place (rien de nouveau a configurer) :
  // INFOMANIAK_API_KEY + PRODUCT_ID (cf. librechat.yaml endpoint Lancya). Le modele
  // defaut = Kimi (bon pour l'extraction) ; surchargable via FICHE_ANALYSIS_MODEL.
  const apiKey = process.env.INFOMANIAK_API_KEY;
  const productId = process.env.PRODUCT_ID;
  const model = process.env.FICHE_ANALYSIS_MODEL || 'moonshotai/Kimi-K2.6';
  if (!apiKey || !productId) {
    logger.warn('[projects] analyse fiche : config absente (INFOMANIAK_API_KEY / PRODUCT_ID)');
    return null;
  }
  const baseURL =
    process.env.FICHE_ANALYSIS_BASE_URL ||
    `https://api.infomaniak.com/2/ai/${productId}/openai/v1`;
  const text = await getDocumentText({ req, file });
  if (!text.trim()) {
    logger.warn(`[projects] analyse fiche : pas de texte exploitable sur « ${file?.filename} »`);
    return null;
  }
  const docText = text.slice(0, 24000);
  const existing = (project.fiche?.items ?? [])
    .map((i) => `- ${i.text}`)
    .join('\n')
    .slice(0, 1500);
  const system =
    "Tu analyses un document ajoute a un projet de travail. Extrais UNIQUEMENT ce qui est essentiel pour suivre le projet : decisions, echeances (avec dates si presentes), points ouverts, et infos cles a retenir. Concis et factuel, jamais d'invention (seulement ce qui figure dans le document). Reponds STRICTEMENT en JSON valide, sans aucun texte autour, au format : {\"summary\":\"1 a 2 phrases sur ce que ce document apporte au projet\",\"items\":[{\"section\":\"decision|deadline|open|action|info\",\"text\":\"...\"}]}. N'utilise jamais de tiret cadratin.";
  const userMsg = `Projet : ${project.name}\n${
    existing ? `Elements deja dans la fiche :\n${existing}\n\n` : ''
  }Document « ${file.filename} » :\n${docText}`;

  let content = '';
  try {
    const resp = await fetch(`${baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });
    if (!resp.ok) {
      logger.warn(`[projects] analyse fiche : statut LLM ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const choice = data?.choices?.[0] ?? {};
    // Modele raisonnant : la reponse est dans message.content ; on retombe sur le champ
    // de raisonnement si content est vide. finish_reason='length' = budget de jetons trop court.
    content = choice.message?.content || choice.message?.reasoning_content || '';
    if (!content) {
      logger.warn(`[projects] analyse fiche : contenu vide (finish_reason=${choice.finish_reason})`);
    }
  } catch (err) {
    logger.warn(`[projects] analyse fiche : appel LLM echoue (${err.message})`);
    return null;
  }

  const parsed = extractJson(content);
  if (!parsed || !Array.isArray(parsed.items)) {
    logger.warn(
      `[projects] analyse fiche : reponse non exploitable. Debut: ${String(content).slice(0, 300)}`,
    );
    return null;
  }
  const stamp = Date.now();
  const items = parsed.items
    .filter((it) => it && typeof it.text === 'string' && it.text.trim())
    .slice(0, 20)
    .map((it, idx) => ({
      id: `f-${stamp}-${idx}`,
      section: FICHE_SECTIONS.includes(it.section) ? it.section : 'info',
      text: String(it.text).slice(0, 2000),
      source: file.filename,
      status: 'proposed',
    }));
  logger.info(`[projects] analyse fiche : ${items.length} element(s) extrait(s) de « ${file.filename} »`);
  return { summary: typeof parsed.summary === 'string' ? parsed.summary : '', items };
}

const SECTION_LABELS = {
  decision: 'Decisions',
  deadline: 'Echeances',
  open: 'Points ouverts',
  action: 'Prochaines actions',
  info: 'Infos cles',
};

/**
 * Produit un debrief (markdown) de l'etat du dossier, a partir de la fiche (etat valide par
 * l'utilisateur) + des metadonnees du projet + de la liste des documents. Renvoie '' si echec.
 * Le « point » a la demande : pas de planification, on s'appuie sur l'etat deja cure.
 */
async function buildProjectBrief({ project, files }) {
  const fiche = project.fiche ?? {};
  const items = Array.isArray(fiche.items) ? fiche.items : [];
  const bySection = {};
  for (const item of items) {
    const sec = FICHE_SECTIONS.includes(item.section) ? item.section : 'info';
    (bySection[sec] ||= []).push(item);
  }
  const ficheText = FICHE_SECTIONS.map((sec) => {
    const list = bySection[sec];
    if (!list || !list.length) {
      return '';
    }
    const lines = list
      .map((item) => `- ${item.text}${item.source ? ` (source : ${item.source})` : ''}`)
      .join('\n');
    return `${SECTION_LABELS[sec]} :\n${lines}`;
  })
    .filter(Boolean)
    .join('\n\n');
  const docNames = (Array.isArray(files) ? files : [])
    .map((file) => `- ${file.filename}`)
    .join('\n');

  const system =
    "Tu produis le DEBRIEF d'un dossier de travail pour un professionnel suisse. A partir des elements fournis (fiche du dossier, liste des documents), redige un point clair et bien structure sur l'etat du dossier : ou en est-on, ce qui est decide, les echeances, les points ouverts, les prochaines actions. Format markdown : un court paragraphe de synthese en tete, puis des sections avec des titres (##) et des listes. Termine par une section 'Prochaines actions' concrete. Reste factuel : appuie-toi UNIQUEMENT sur les elements fournis, n'invente rien ; si un volet est vide, dis-le simplement. Cite les sources entre parentheses quand elles sont connues. Style : francais, naturel, professionnel. N'utilise JAMAIS de tiret cadratin ni demi-cadratin (utilise virgule, parentheses ou deux-points). Pas de tournures qui sentent l'IA.";
  const user =
    `Dossier : ${project.name}\n` +
    (project.description ? `Description : ${project.description}\n` : '') +
    `\nDocuments du dossier :\n${docNames || '(aucun document)'}\n` +
    `\nFiche du dossier (etat valide) :\n${fiche.summary ? `Resume : ${fiche.summary}\n` : ''}${
      ficheText || '(fiche encore vide)'
    }\n\nRedige le debrief complet du dossier.`;

  return callLancyaModel({ system, user, maxTokens: 3000, temperature: 0.3 });
}

router.use(requireJwtAuth);

router.get('/', handlers.listProjects);
router.post('/', handlers.createProject);
router.put('/conversations/:conversationId', handlers.assignConversationToProject);

/**
 * Rattache un document (deja uploade) au projet ET lance son analyse vers la fiche
 * (best-effort). Renvoie le projet mis a jour (fileIds + fiche avec elements proposes).
 */
router.post('/:projectId/documents', async (req, res) => {
  const userId = req.user?.id ?? req.user?._id?.toString() ?? '';
  const { projectId } = req.params;
  const fileId = req.body?.fileId;
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'fileId is required' });
  }
  try {
    const project = await db.getChatProject(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const fileIds = Array.isArray(project.fileIds) ? [...project.fileIds] : [];
    if (!fileIds.includes(fileId)) {
      fileIds.push(fileId);
    }

    let ficheUpdate;
    try {
      // IMPORTANT : getFiles exclut `text` par defaut (select { text: 0 }). On le demande
      // explicitement, sinon le texte extrait du document est vide et l'analyse ne lit rien.
      const files = await db.getFiles(
        { file_id: fileId },
        null,
        { text: 1, filename: 1, file_id: 1, bytes: 1, source: 1, storageKey: 1, filepath: 1 },
      );
      const file = Array.isArray(files) ? files[0] : files;
      if (file) {
        const analysis = await analyzeDocumentToFiche({ req, project, file });
        if (analysis && analysis.items.length) {
          ficheUpdate = {
            summary: project.fiche?.summary || analysis.summary || '',
            items: [...(project.fiche?.items ?? []), ...analysis.items],
          };
        }
      }
    } catch (err) {
      logger.warn(`[projects] analyse fiche ignoree (${err.message})`);
    }

    const input = ficheUpdate ? { fileIds, fiche: ficheUpdate } : { fileIds };
    const updated = await db.updateChatProject(userId, projectId, input);
    return res.status(200).json(updated);
  } catch (error) {
    logger.error('[projects] Error adding document', error);
    return res.status(500).json({ error: 'Error adding document' });
  }
});

/**
 * « Faire le point » : produit a la demande un debrief markdown de l'etat du dossier
 * (fiche validee + documents). Renvoie { brief }. Best-effort cote modele : 502 si la
 * generation echoue, pour que le front affiche un message clair.
 */
router.post('/:projectId/brief', async (req, res) => {
  const userId = req.user?.id ?? req.user?._id?.toString() ?? '';
  const { projectId } = req.params;
  try {
    const project = await db.getChatProject(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const fileIds = Array.isArray(project.fileIds) ? project.fileIds : [];
    let files = [];
    if (fileIds.length > 0) {
      files = await db.getFiles({ file_id: { $in: fileIds } }, null, { filename: 1, file_id: 1 });
    }
    const brief = await buildProjectBrief({ project, files });
    if (!brief.trim()) {
      return res.status(502).json({ error: 'brief generation failed' });
    }
    return res.status(200).json({ brief });
  } catch (error) {
    logger.error('[projects] Error building brief', error);
    return res.status(500).json({ error: 'Error building brief' });
  }
});

router.get('/:projectId', handlers.getProject);
router.patch('/:projectId', handlers.updateProject);
router.delete('/:projectId', handlers.deleteProject);

module.exports = router;
