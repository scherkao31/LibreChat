# Lancya — connecteur email (MCP, lecture seule)

Petit service MCP qui permet à Lancya de **lire** la boîte email de l'utilisateur (lister les
dossiers, chercher, lire un message). Conçu pour Infomaniak Mail (IMAP) mais marche avec
n'importe quel serveur IMAP (Gmail, Outlook... via mot de passe d'application).

C'est le **premier connecteur** et le **modèle** pour les suivants (agenda, kDrive, etc.) :
même principe partout, on ne change que ce petit service par service.

## Principe (important pour la confidentialité)
- Ce service **n'a pas de compte** et **ne stocke rien**. Pour chaque requête, Lancya lui envoie
  les identifiants de l'utilisateur courant dans des **en-têtes** (`X-Imap-User`, `X-Imap-Pass`,
  `X-Imap-Host`), tirés de ses `customUserVars`. On ouvre IMAP à la volée, on lit, on ferme.
- **Lecture seule** : pas d'envoi ni de suppression. La rédaction des réponses se fait côté
  Lancya ; l'utilisateur envoie lui-même depuis sa messagerie. (On pourra ajouter l'envoi plus
  tard, avec confirmation explicite.)

## Déploiement (Railway, nouveau service)
1. Nouveau service Railway, **root directory = `mcp-servers/email`**.
2. Build : `npm install`. Start : `npm start`.
3. Variable d'env optionnelle : `DEFAULT_IMAP_HOST=mail.infomaniak.com`.
4. Note l'URL interne/publique du service (ex. `https://lancya-email.up.railway.app`).

## Configuration dans `librechat.yaml`
```yaml
mcpServers:
  email:
    type: streamable-http
    url: "https://<URL-DU-SERVICE>/mcp"
    title: "Ma boîte email"
    description: "Connectez votre boîte (lecture seule)"
    chatMenu: true
    startup: false
    headers:
      X-Imap-User: "{{IMAP_USER}}"
      X-Imap-Pass: "{{IMAP_PASS}}"
      X-Imap-Host: "mail.infomaniak.com"
    customUserVars:
      IMAP_USER:
        title: "Adresse email"
        description: "Votre adresse Infomaniak (ex. prenom.nom@infomaniak.com)"
      IMAP_PASS:
        title: "Mot de passe d'application"
        description: "Généré dans votre espace Infomaniak, séparé de votre mot de passe principal"
```
Si la protection anti-SSRF bloque l'URL, autoriser le domaine du service dans `mcpSettings`
(`allowedDomains` / `allowedAddresses`).

## Parcours utilisateur
1. Dans Lancya, ouvrir les connexions (icône prise) → activer « Ma boîte email ».
2. Saisir son adresse + un **mot de passe d'application** Infomaniak (généré une fois).
3. En conversation : « résume mes mails non lus », « trouve le mail de X sur le dossier Y »,
   « rédige une réponse à celui-ci ».

## Statut
v1 à **déployer puis tester** (le service n'a pas pu être exécuté en local). On itère après le
premier branchement réel.
