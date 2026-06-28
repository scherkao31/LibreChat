import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDAVClient } from 'tsdav';
import ical from 'node-ical';
import { z } from 'zod';

/**
 * Serveur MCP agenda pour Lancya — LECTURE SEULE (calendriers + evenements, via CalDAV).
 *
 * Meme principe que le serveur email : ce service N'A PAS de compte. Pour chaque requete, Lancya
 * envoie les identifiants de l'utilisateur dans des en-tetes (X-Caldav-User / X-Caldav-Pass /
 * X-Caldav-Url), tires de ses customUserVars. On se connecte en CalDAV a la volee, on lit, on ferme.
 * Rien n'est stocke ici. Volontairement read-only (aucune ecriture, aucune creation d'evenement).
 *
 * Infomaniak : serveur https://sync.infomaniak.com/ , identifiant = le NOM D'UTILISATEUR du compte
 * (ex. abc12345, trouvable sur config.infomaniak.com), PAS l'adresse email ; mot de passe = le meme
 * mot de passe d'application que pour l'email.
 */

const PORT = process.env.PORT || 8080;
const DEFAULT_CALDAV_URL = process.env.DEFAULT_CALDAV_URL || 'https://sync.infomaniak.com/';

function davClient(creds) {
  // Specificites Infomaniak (confirmees par la config davx5) :
  //  (1) l'identifiant d'auth est le COMPTE, sans le suffixe @sync.infomaniak.com (l'email echoue) ;
  //  (2) la decouverte CalDAV sur la RACINE renvoie 401 / "no service" -> il faut pointer
  //      directement sur le calendar-home de l'utilisateur : /calendars/<compte>/ .
  const user = String(creds.user || '')
    .replace(/@sync\.infomaniak\.com$/i, '')
    .trim();
  const base = String(creds.url || DEFAULT_CALDAV_URL).replace(/\/+$/, '');
  const serverUrl = base.includes('/calendars/')
    ? `${base}/`
    : `${base}/calendars/${encodeURIComponent(user)}/`;
  return createDAVClient({
    serverUrl,
    credentials: { username: user, password: creds.pass },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
}

/** Extrait les VEVENT d'un objet iCalendar (un calendarObject CalDAV). Robuste : ne jette pas. */
function parseEvents(icalData) {
  const out = [];
  let parsed;
  try {
    parsed = ical.sync.parseICS(icalData);
  } catch {
    return out;
  }
  for (const key of Object.keys(parsed)) {
    const v = parsed[key];
    if (v && v.type === 'VEVENT') {
      out.push({
        summary: v.summary || '',
        start: v.start || null,
        end: v.end || null,
        location: v.location || '',
      });
    }
  }
  return out;
}

/** Construit un serveur MCP dont les outils utilisent les identifiants de CET utilisateur. */
function buildServer(creds) {
  const server = new McpServer({ name: 'lancya-agenda', version: '0.2.0' });

  server.registerTool(
    'list_calendars',
    {
      description: "Liste les calendriers (agendas) de l'utilisateur.",
      inputSchema: {},
    },
    async () => {
      try {
        const client = await davClient(creds);
        const calendars = await client.fetchCalendars();
        const names = calendars.map((c) => c.displayName || c.url || '').filter(Boolean);
        return { content: [{ type: 'text', text: JSON.stringify(names) }] };
      } catch (err) {
        console.error('[agenda] list_calendars error:', err?.stack ?? err?.message ?? err);
        return {
          content: [
            { type: 'text', text: `Erreur agenda (calendriers) : ${String(err?.message ?? err)}` },
          ],
        };
      }
    },
  );

  server.registerTool(
    'list_events',
    {
      description:
        "Liste les evenements de l'agenda dans une fenetre de temps (defaut : les 14 prochains jours). Optionnels : daysAhead (jours a venir, defaut 14), daysBack (jours passes, defaut 0), query (filtre sur le titre/lieu, ex. un nom de client ou de dossier), limit. Renvoie titre, debut, fin, lieu et calendrier, tries par date. A utiliser pour « qu'est-ce que j'ai cette semaine », les echeances a venir, ou les rendez-vous lies a un dossier. NB : les evenements recurrents ne sont pas encore deplies (on liste leur occurrence de base).",
      inputSchema: {
        daysAhead: z.number().optional(),
        daysBack: z.number().optional(),
        query: z.string().optional(),
        limit: z.number().optional(),
      },
    },
    async ({ daysAhead = 14, daysBack = 0, query, limit = 50 }) => {
      try {
        const client = await davClient(creds);
        const calendars = await client.fetchCalendars();
        const now = Date.now();
        const start = new Date(now - Math.max(0, daysBack) * 86400000);
        const end = new Date(now + Math.max(1, daysAhead) * 86400000);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const q = query ? String(query).toLowerCase() : '';

        const all = [];
        for (const calendar of calendars) {
          try {
            const objects = await client.fetchCalendarObjects({
              calendar,
              timeRange: { start: startIso, end: endIso },
            });
            for (const obj of objects) {
              if (!obj || !obj.data) {
                continue;
              }
              for (const ev of parseEvents(obj.data)) {
                if (!ev.start) {
                  continue;
                }
                const evStart = new Date(ev.start);
                if (Number.isNaN(evStart.getTime()) || evStart < start || evStart > end) {
                  continue;
                }
                if (q && !`${ev.summary} ${ev.location}`.toLowerCase().includes(q)) {
                  continue;
                }
                all.push({
                  calendar: calendar.displayName || '',
                  summary: ev.summary,
                  start: ev.start,
                  end: ev.end,
                  location: ev.location,
                });
              }
            }
          } catch (calErr) {
            console.error('[agenda] calendar skipped:', calErr?.message ?? calErr);
          }
        }
        all.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        return {
          content: [{ type: 'text', text: JSON.stringify(all.slice(0, Math.min(limit, 100))) }],
        };
      } catch (err) {
        console.error('[agenda] list_events error:', err?.stack ?? err?.message ?? err);
        return {
          content: [{ type: 'text', text: `Erreur agenda : ${String(err?.message ?? err)}` }],
        };
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
    user: req.headers['x-caldav-user'],
    pass: req.headers['x-caldav-pass'],
    url: req.headers['x-caldav-url'] || DEFAULT_CALDAV_URL,
  };
  if (!creds.user || !creds.pass) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Identifiants agenda manquants (X-Caldav-User / X-Caldav-Pass).' },
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
  console.log(`Lancya agenda MCP server (read-only) sur le port ${PORT}`);
});
