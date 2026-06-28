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

/** Texte lisible d'un message (privilegie .text, sinon assemble les parties .content). */
function messageText(message) {
  if (typeof message?.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }
  if (Array.isArray(message?.content)) {
    return message.content
      .map((part) => {
        if (typeof part?.text === 'string') {
          return part.text;
        }
        if (part?.text && typeof part.text.value === 'string') {
          return part.text.value;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

/**
 * Debrief d'une CONVERSATION du projet vers la fiche : lit les messages, demande au modele
 * ce qui merite d'etre retenu (decisions, echeances, points ouverts, actions) et le renvoie
 * comme elements PROPOSES (l'user valide). Dedup via les elements deja en fiche. Renvoie null
 * si rien d'exploitable. Reutilise callLancyaModel + extractJson (meme recette que la fiche doc).
 */
async function analyzeConversationToFiche({ req, project, conversationId }) {
  const userId = req.user?.id ?? req.user?._id?.toString() ?? '';
  let messages = [];
  try {
    messages = await db.getMessages({ conversationId, user: userId });
  } catch (err) {
    logger.warn(`[projects] debrief : lecture des messages echouee (${err.message})`);
    return null;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }
  // Garde la fin de la conversation (le plus recent) si elle est longue.
  const transcript = messages
    .map((message) => {
      const role = message.isCreatedByUser ? 'Utilisateur' : 'Assistant';
      const text = messageText(message);
      return text ? `${role} : ${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(-16000);
  if (!transcript.trim()) {
    return null;
  }
  const existing = (project.fiche?.items ?? [])
    .map((item) => `- ${item.text}`)
    .join('\n')
    .slice(0, 1500);
  const system =
    "Tu analyses une CONVERSATION rattachee a un dossier de travail. Extrais UNIQUEMENT ce qui merite d'etre garde dans la fiche du dossier : decisions prises, echeances (avec dates si presentes), points ouverts a suivre, prochaines actions, infos cles durables. Ignore le bavardage et l'ephemere. N'invente rien (uniquement ce qui figure dans la conversation). Ne repete PAS un element deja present dans la fiche. Reponds STRICTEMENT en JSON valide, sans texte autour : {\"items\":[{\"section\":\"decision|deadline|open|action|info\",\"text\":\"...\"}]}. Si rien ne merite d'etre retenu, renvoie {\"items\":[]}. N'utilise jamais de tiret cadratin.";
  const userMsg = `Dossier : ${project.name}\n${
    existing ? `Deja dans la fiche :\n${existing}\n\n` : ''
  }Conversation :\n${transcript}`;

  const content = await callLancyaModel({ system, user: userMsg, maxTokens: 1500, temperature: 0.2 });
  const parsed = extractJson(content);
  if (!parsed || !Array.isArray(parsed.items)) {
    logger.warn(`[projects] debrief : reponse non exploitable. Debut: ${String(content).slice(0, 200)}`);
    return null;
  }
  const last = messages[messages.length - 1];
  const when = last?.createdAt ? new Date(last.createdAt) : new Date();
  const dateLabel = `${String(when.getDate()).padStart(2, '0')}.${String(when.getMonth() + 1).padStart(2, '0')}.${when.getFullYear()}`;
  const stamp = Date.now();
  const items = parsed.items
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .slice(0, 15)
    .map((item, idx) => ({
      id: `c-${stamp}-${idx}`,
      section: FICHE_SECTIONS.includes(item.section) ? item.section : 'info',
      text: String(item.text).slice(0, 2000),
      source: `Discussion du ${dateLabel}`,
      status: 'proposed',
    }));
  logger.info(`[projects] debrief : ${items.length} element(s) proposes depuis la conversation`);
  return { items };
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
    "Tu produis le DEBRIEF d'un dossier de travail pour un professionnel suisse, a partir des elements fournis (fiche du dossier, liste des documents). Objectif : un point clair sur l'etat du dossier (ou en est-on, ce qui est decide, les echeances, les points ouverts, les prochaines actions).\n\n" +
    "MISE EN FORME (markdown soigne, c'est important pour la lisibilite) :\n" +
    "- Commence par un court paragraphe de synthese (2 a 3 phrases), sans titre.\n" +
    "- Ensuite, des sections avec des titres de niveau 2, par exemple : « ## Etat du dossier », « ## Decisions », « ## Echeances », « ## Points ouverts », « ## Prochaines actions ». N'inclus QUE les sections pertinentes.\n" +
    "- Sous chaque titre, utilise des listes a puces (commence chaque ligne par « - »).\n" +
    "- Mets en gras (**...**) les informations cles : dates, montants, noms, chiffres.\n" +
    "- Cite la source entre parentheses quand elle est connue.\n\n" +
    "FOND : reste strictement factuel, appuie-toi UNIQUEMENT sur les elements fournis, n'invente rien. Si un volet est vide, ne mets pas la section correspondante (ou dis brievement qu'il n'y a rien).\n\n" +
    "STYLE : francais, naturel, professionnel. N'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–) : a la place, virgule, parentheses ou deux-points. Pas de tournures qui sentent l'IA.";
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

/**
 * Sauvegarde un « point » dans l'historique du dossier (le plus recent en tete, cap a 30).
 * Renvoie le projet mis a jour (avec briefs). Le texte vient du front (deja genere).
 */
router.post('/:projectId/briefs', async (req, res) => {
  const userId = req.user?.id ?? req.user?._id?.toString() ?? '';
  const { projectId } = req.params;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }
  try {
    const project = await db.getChatProject(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const previous = Array.isArray(project.briefs) ? project.briefs : [];
    const brief = { id: `b-${Date.now()}`, text: text.slice(0, 20000), createdAt: new Date() };
    const briefs = [brief, ...previous].slice(0, 30);
    const updated = await db.updateChatProject(userId, projectId, { briefs });
    return res.status(200).json(updated);
  } catch (error) {
    logger.error('[projects] Error saving brief', error);
    return res.status(500).json({ error: 'Error saving brief' });
  }
});

/**
 * Debrief : complete la fiche du dossier a partir d'une conversation (par defaut la derniere).
 * L'IA propose des elements (l'user valide ensuite). Renvoie { project, added }.
 */
router.post('/:projectId/debrief', async (req, res) => {
  const userId = req.user?.id ?? req.user?._id?.toString() ?? '';
  const { projectId } = req.params;
  try {
    const project = await db.getChatProject(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const conversationId =
      (typeof req.body?.conversationId === 'string' && req.body.conversationId) ||
      project.lastConversationId;
    if (!conversationId) {
      return res.status(400).json({ error: 'no conversation' });
    }
    const analysis = await analyzeConversationToFiche({ req, project, conversationId });
    if (!analysis || analysis.items.length === 0) {
      return res.status(200).json({ project, added: 0 });
    }
    const fiche = {
      summary: project.fiche?.summary || '',
      items: [...(project.fiche?.items ?? []), ...analysis.items],
    };
    const updated = await db.updateChatProject(userId, projectId, { fiche });
    return res.status(200).json({ project: updated, added: analysis.items.length });
  } catch (error) {
    logger.error('[projects] Error debrief', error);
    return res.status(500).json({ error: 'Error debrief' });
  }
});

/**
 * Range un livrable (contenu produit en discussion) dans le dossier (le plus recent en tete,
 * cap a 50). Renvoie le projet mis a jour (avec deliverables). Contenu + titre viennent du front.
 */
router.post('/:projectId/deliverables', async (req, res) => {
  const userId = req.user?.id ?? req.user?._id?.toString() ?? '';
  const { projectId } = req.params;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }
  try {
    const project = await db.getChatProject(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const previous = Array.isArray(project.deliverables) ? project.deliverables : [];
    const deliverable = {
      id: `d-${Date.now()}`,
      title: title || content.split('\n').find((l) => l.trim())?.slice(0, 80) || 'Livrable',
      content: content.slice(0, 20000),
      createdAt: new Date(),
    };
    const deliverables = [deliverable, ...previous].slice(0, 50);
    const updated = await db.updateChatProject(userId, projectId, { deliverables });
    return res.status(200).json(updated);
  } catch (error) {
    logger.error('[projects] Error saving deliverable', error);
    return res.status(500).json({ error: 'Error saving deliverable' });
  }
});

router.get('/:projectId', handlers.getProject);
router.patch('/:projectId', handlers.updateProject);
router.delete('/:projectId', handlers.deleteProject);

module.exports = router;
