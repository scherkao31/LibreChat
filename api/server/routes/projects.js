const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { createProjectHandlers } = require('@librechat/api');
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

/** Extrait le premier objet JSON d'une reponse LLM (tolerant au texte autour). */
function extractJson(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Analyse un document et propose des elements pour la fiche du projet. BEST-EFFORT :
 * renvoie null si l'analyse n'est pas configuree (variables d'env) ou echoue, sans jamais
 * bloquer l'ajout du document. Appel LLM direct vers un endpoint OpenAI-compatible dedie
 * (FICHE_ANALYSIS_BASE_URL / _API_KEY / _MODEL), decouple du chat.
 */
async function analyzeDocumentToFiche({ project, file }) {
  // Reutilise la config Infomaniak DEJA en place (rien de nouveau a configurer) :
  // INFOMANIAK_API_KEY + PRODUCT_ID (cf. librechat.yaml endpoint Lancya). Le modele
  // defaut = Kimi (bon pour l'extraction) ; surchargable via FICHE_ANALYSIS_MODEL.
  const apiKey = process.env.INFOMANIAK_API_KEY;
  const productId = process.env.PRODUCT_ID;
  const model = process.env.FICHE_ANALYSIS_MODEL || 'moonshotai/Kimi-K2.6';
  if (!apiKey || !productId) {
    return null;
  }
  const baseURL =
    process.env.FICHE_ANALYSIS_BASE_URL ||
    `https://api.infomaniak.com/2/ai/${productId}/openai/v1`;
  const text = typeof file?.text === 'string' ? file.text : '';
  if (!text.trim()) {
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
        max_tokens: 900,
      }),
    });
    if (!resp.ok) {
      logger.warn(`[projects] analyse fiche : statut LLM ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    content = data?.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    logger.warn(`[projects] analyse fiche : appel LLM echoue (${err.message})`);
    return null;
  }

  const parsed = extractJson(content);
  if (!parsed || !Array.isArray(parsed.items)) {
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
  return { summary: typeof parsed.summary === 'string' ? parsed.summary : '', items };
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
      const files = await db.getFiles({ file_id: fileId });
      const file = Array.isArray(files) ? files[0] : files;
      if (file) {
        const analysis = await analyzeDocumentToFiche({ project, file });
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

router.get('/:projectId', handlers.getProject);
router.patch('/:projectId', handlers.updateProject);
router.delete('/:projectId', handlers.deleteProject);

module.exports = router;
