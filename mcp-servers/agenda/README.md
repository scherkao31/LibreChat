# Lancya — connecteur agenda (MCP, lecture seule)

Petit service MCP qui permet à Lancya de **lire** l'agenda de l'utilisateur (lister les
calendriers, lister les évènements à venir, filtrer par mot-clé). Conçu pour Infomaniak Calendar
(CalDAV) mais marche avec n'importe quel serveur CalDAV.

C'est le **deuxième connecteur**, sur le **même modèle** que l'email : on ne change que ce petit
service. Volontairement **lecture seule** (aucune création/modification d'évènement).

## Principe (confidentialité)
- Ce service **n'a pas de compte** et **ne stocke rien**. Pour chaque requête, Lancya lui envoie
  les identifiants de l'utilisateur dans des **en-têtes** (`X-Caldav-User`, `X-Caldav-Pass`,
  `X-Caldav-Url`), tirés de ses `customUserVars`. On ouvre CalDAV à la volée, on lit, on ferme.

## Infomaniak : un détail important
- Serveur CalDAV : `https://sync.infomaniak.com/`.
- Identifiant (`X-Caldav-User`) = le **nom d'utilisateur du compte** (ex. `abc12345`), trouvable
  sur https://config.infomaniak.com . **Ce n'est PAS l'adresse email** (contrairement au connecteur
  email). C'est le seul piège.
- Mot de passe = le **même mot de passe d'application** que pour l'email.

## Déploiement (Railway, nouveau service)
1. Nouveau service Railway, **root directory = `mcp-servers/agenda`**.
2. Build : `npm install`. Start : `npm start`.
3. Génère un domaine (Networking → Generate Domain), note l'URL.
4. Vérifie `https://<URL>/health` → `{"ok":true}`.

## Configuration dans `librechat.yaml`
```yaml
mcpServers:
  agenda:
    type: streamable-http
    url: "https://<URL-DU-SERVICE>/mcp"
    title: "Agenda"
    description: "Connectez votre agenda Infomaniak (lecture seule)."
    chatMenu: true
    startup: false
    headers:
      X-Caldav-User: "{{CALDAV_USER}}"
      X-Caldav-Pass: "{{CALDAV_PASS}}"
      X-Caldav-Url: "https://sync.infomaniak.com/"
    customUserVars:
      CALDAV_USER:
        title: "Nom d'utilisateur Infomaniak"
        description: "Votre identifiant de compte (ex. abc12345), sur config.infomaniak.com. Ce n'est PAS votre adresse email."
        sensitive: false
      CALDAV_PASS:
        title: "Mot de passe d'application"
        description: "Le même que pour la messagerie (généré dans votre espace Infomaniak)."
```
Puis ajouter `"agenda"` à la liste `mcpServers` du modelSpec Lancya (à côté de `"email"`).

## Parcours utilisateur
1. Dans Lancya, ouvrir les connexions (icône prise) → activer « Agenda ».
2. Saisir son **nom d'utilisateur Infomaniak** + le mot de passe d'application.
3. En conversation : « qu'est-ce que j'ai cette semaine ? », « quels rendez-vous avec Dupont ? »,
   « quelles échéances à venir sur ce dossier ? ».

## Statut
v1 à **déployer puis tester** (pas exécutable en local). Incertitudes à vérifier au 1er run :
auth CalDAV Infomaniak (identifiant = username du compte), API exacte `tsdav` (`fetchCalendarObjects`
+ `timeRange`) et `node-ical` (`sync.parseICS`). Les évènements récurrents ne sont pas encore dépliés.
