import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { z } from 'zod';

/**
 * Serveur MCP email pour Lancya — LECTURE SEULE (lister, chercher, lire).
 *
 * Principe : ce service N'A PAS de compte. Pour chaque requete, Lancya envoie les identifiants
 * de l'utilisateur courant dans des en-tetes (X-Imap-User / X-Imap-Pass / X-Imap-Host), tires de
 * ses customUserVars. On ouvre une connexion IMAP a la volee, on fait l'operation, on ferme.
 * Rien n'est stocke ici : ni mot de passe, ni email. Volontairement read-only (pas d'envoi ni de
 * suppression) : la redaction des reponses se fait cote Lancya, l'utilisateur envoie lui-meme.
 */

const PORT = process.env.PORT || 8080;
const DEFAULT_IMAP_HOST = process.env.DEFAULT_IMAP_HOST || 'mail.infomaniak.com';

function imapClient(creds) {
  return new ImapFlow({
    host: creds.host,
    port: 993,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
  });
}

/** Construit un serveur MCP dont les outils utilisent les identifiants de CET utilisateur. */
function buildServer(creds) {
  const server = new McpServer({ name: 'lancya-email', version: '0.2.0' });

  server.registerTool(
    'list_folders',
    {
      description: "Liste les dossiers (boites) de la messagerie de l'utilisateur.",
      inputSchema: {},
    },
    async () => {
      const client = imapClient(creds);
      await client.connect();
      try {
        const boxes = await client.list();
        return { content: [{ type: 'text', text: JSON.stringify(boxes.map((b) => b.path)) }] };
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  server.registerTool(
    'search_emails',
    {
      description:
        "Cherche des emails dans un dossier (defaut INBOX). Filtres optionnels : from, subject, since (date YYYY-MM-DD), unseenOnly. Renvoie expediteur, objet, date et uid, SANS le corps. Utilise ensuite read_email avec l'uid pour lire un message.",
      inputSchema: {
        folder: z.string().optional(),
        from: z.string().optional(),
        subject: z.string().optional(),
        since: z.string().optional(),
        unseenOnly: z.boolean().optional(),
        limit: z.number().optional(),
      },
    },
    async ({ folder = 'INBOX', from, subject, since, unseenOnly, limit = 15 }) => {
      const client = imapClient(creds);
      await client.connect();
      try {
        await client.mailboxOpen(folder, { readOnly: true });
        const criteria = {};
        if (from) criteria.from = from;
        if (subject) criteria.subject = subject;
        if (since) criteria.since = new Date(since);
        if (unseenOnly) criteria.seen = false;
        const uids = await client.search(criteria, { uid: true });
        const recent = uids.slice(-Math.min(limit, 50)).reverse();
        const results = [];
        if (recent.length > 0) {
          for await (const msg of client.fetch(
            recent,
            { uid: true, envelope: true, internalDate: true },
            { uid: true },
          )) {
            results.push({
              uid: msg.uid,
              messageId: msg.envelope?.messageId ?? '',
              from: (msg.envelope?.from ?? []).map((a) => a.address).join(', '),
              subject: msg.envelope?.subject ?? '',
              date: msg.internalDate,
            });
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  server.registerTool(
    'read_email',
    {
      description: "Lit le contenu texte d'un email par son uid, dans un dossier (defaut INBOX).",
      inputSchema: { uid: z.number(), folder: z.string().optional() },
    },
    async ({ uid, folder = 'INBOX' }) => {
      const client = imapClient(creds);
      await client.connect();
      try {
        await client.mailboxOpen(folder, { readOnly: true });
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) {
          return { content: [{ type: 'text', text: 'Email introuvable.' }] };
        }
        const parsed = await simpleParser(msg.source);
        const out = {
          messageId: parsed.messageId ?? '',
          from: parsed.from?.text ?? '',
          to: parsed.to?.text ?? '',
          subject: parsed.subject ?? '',
          date: parsed.date,
          text: (parsed.text ?? '').slice(0, 20000),
        };
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  server.registerTool(
    'read_thread',
    {
      description:
        "Recupere TOUT l'echange (le fil) sur un sujet donne : les messages RECUS et ENVOYES qui partagent ce sujet, tries par date, avec leur texte. A utiliser pour 'montre-moi toute la discussion avec X sur Y', faire le point sur un echange, ou suivre un fil dans un dossier. Donne le sujet du fil (le prefixe Re:/Fwd: est ignore). Optionnel : from (adresse d'un correspondant) pour cibler, limit.",
      inputSchema: {
        subject: z.string(),
        from: z.string().optional(),
        limit: z.number().optional(),
      },
    },
    async ({ subject, from, limit = 20 }) => {
      const client = imapClient(creds);
      await client.connect();
      try {
        // Pour avoir les DEUX cotes du fil, on cherche dans INBOX + le dossier Envoyes,
        // repere via le flag special-use \Sent (son nom varie selon la langue/serveur).
        const boxes = await client.list();
        const sent = boxes.find((b) => (b.specialUse || '').toLowerCase() === '\\sent');
        const folders = ['INBOX'];
        if (sent && sent.path && sent.path !== 'INBOX') {
          folders.push(sent.path);
        }
        const normalized = subject.replace(/^((re|fwd|fw|tr|aw)\s*:\s*)+/i, '').trim();

        const collected = [];
        for (const folder of folders) {
          try {
            await client.mailboxOpen(folder, { readOnly: true });
            const criteria = { subject: normalized };
            if (from) {
              // Dans INBOX le correspondant est l'expediteur ; dans Envoyes, le destinataire.
              if (folder === 'INBOX') {
                criteria.from = from;
              } else {
                criteria.to = from;
              }
            }
            const uids = await client.search(criteria, { uid: true });
            const recent = uids.slice(-Math.min(limit, 40));
            if (recent.length === 0) {
              continue;
            }
            for await (const msg of client.fetch(
              recent,
              { uid: true, envelope: true, internalDate: true, source: true },
              { uid: true },
            )) {
              let text = '';
              try {
                const parsed = await simpleParser(msg.source);
                text = (parsed.text ?? '').slice(0, 4000);
              } catch {
                text = '';
              }
              collected.push({
                direction: folder === 'INBOX' ? 'recu' : 'envoye',
                from: (msg.envelope?.from ?? []).map((a) => a.address).join(', '),
                to: (msg.envelope?.to ?? []).map((a) => a.address).join(', '),
                subject: msg.envelope?.subject ?? '',
                date: msg.internalDate,
                messageId: msg.envelope?.messageId ?? '',
                text,
              });
            }
          } catch {
            // dossier inaccessible : on passe au suivant
          }
        }
        collected.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return { content: [{ type: 'text', text: JSON.stringify(collected.slice(-limit)) }] };
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  return server;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/mcp', async (req, res) => {
  const creds = {
    user: req.headers['x-imap-user'],
    pass: req.headers['x-imap-pass'],
    host: req.headers['x-imap-host'] || DEFAULT_IMAP_HOST,
  };
  if (!creds.user || !creds.pass) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Identifiants email manquants (X-Imap-User / X-Imap-Pass).' },
      id: null,
    });
    return;
  }
  const server = buildServer(creds);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: String(err?.message ?? err) },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Lancya email MCP server (read-only) sur le port ${PORT}`);
});
