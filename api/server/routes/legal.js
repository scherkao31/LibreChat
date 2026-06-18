const express = require('express');

const router = express.Router();

/**
 * Pages legales Lancya servies cote serveur (hors SPA) pour que
 * https://www.lancya.ch/confidentialite et /conditions repondent par de vraies
 * pages HTML autonomes (referencees dans l'ecran de consentement Google OAuth
 * et le pied de page de l'app). Positionnement HONNETE : on n'affirme que le vrai
 * (inference et stockage en Suisse), et on detaille chaque traitement et sa
 * localisation. A faire relire par un juriste avant usage definitif.
 */

const UPDATED = '17 juin 2026';
const CONTACT = 'contact@lancya.ch';

const layout = (title, body) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} . Lancya</title>
<style>
  :root { --ink:#1f2937; --muted:#6b7280; --accent:#1F3A5F; --line:#e5e7eb; --bg:#f8fafc; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.65; font-size:16px; }
  .wrap { max-width:760px; margin:0 auto; padding:48px 24px 80px; }
  header.brand { display:flex; align-items:baseline; gap:10px; margin-bottom:8px; }
  header.brand .name { font-weight:700; font-size:20px; color:var(--accent); letter-spacing:.2px; }
  header.brand .tag { font-size:13px; color:var(--muted); }
  h1 { font-size:30px; line-height:1.2; margin:18px 0 4px; }
  .updated { color:var(--muted); font-size:14px; margin-bottom:28px; }
  .note { background:#fff; border:1px solid var(--line); border-left:4px solid var(--accent);
    border-radius:8px; padding:14px 18px; margin:0 0 32px; font-size:14.5px; color:#374151; }
  h2 { font-size:20px; margin:34px 0 10px; color:var(--accent); }
  p, li { color:var(--ink); }
  ul { padding-left:22px; }
  li { margin:6px 0; }
  a { color:var(--accent); }
  table.map { width:100%; border-collapse:collapse; margin:14px 0 4px; font-size:14.5px; }
  table.map th, table.map td { border:1px solid var(--line); padding:10px 12px; text-align:left; vertical-align:top; }
  table.map th { background:#eef2f7; color:var(--accent); font-weight:600; }
  table.map td.loc { white-space:nowrap; font-weight:600; }
  .flag-ch { color:#1F3A5F; }
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line);
    color:var(--muted); font-size:13.5px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  footer a { color:var(--muted); text-decoration:none; }
  footer a:hover { text-decoration:underline; }
  /* FAQ : accordeon repliable (questions cliquables) */
  .faq-cat { font-size:12.5px; text-transform:uppercase; letter-spacing:.7px; color:var(--muted);
    font-weight:700; margin:36px 0 12px; }
  .faq-cat:first-of-type { margin-top:24px; }
  details.faq { background:#fff; border:1px solid var(--line); border-radius:12px; margin:10px 0;
    transition:border-color .15s, box-shadow .15s; }
  details.faq[open] { border-color:#d5dde7; box-shadow:0 1px 3px rgba(31,58,95,.06); }
  details.faq summary { cursor:pointer; list-style:none; padding:16px 18px; font-weight:600;
    font-size:16px; color:var(--ink); display:flex; align-items:center; justify-content:space-between; gap:14px; }
  details.faq summary::-webkit-details-marker { display:none; }
  details.faq summary::after { content:"+"; color:var(--accent); font-size:22px; font-weight:400;
    line-height:1; flex:0 0 auto; }
  details.faq[open] summary::after { content:"\\2212"; }
  details.faq summary:hover { color:var(--accent); }
  details.faq .answer { padding:0 18px 18px; color:#374151; font-size:15px; line-height:1.65; }
  details.faq .answer > :first-child { margin-top:0; }
  details.faq .answer > :last-child { margin-bottom:0; }
  details.faq .answer ul { margin:8px 0; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="brand">
      <span class="name">Lancya</span>
      <span class="tag">Espace de travail IA, hébergé en Suisse</span>
    </header>
    ${body}
    <footer>
      <span>&copy; 2026 Lancya</span>
      <span>
        <a href="/confidentialite">Confidentialite</a> &nbsp;.&nbsp;
        <a href="/conditions">Conditions d'utilisation</a> &nbsp;.&nbsp;
        <a href="/">Retour a l'application</a>
      </span>
    </footer>
  </div>
</body>
</html>`;

const PRIVACY = layout(
  'Politique de confidentialite',
  `
  <h1>Politique de confidentialite</h1>
  <div class="updated">Derniere mise a jour : ${UPDATED}</div>
  <div class="note">
    Version preliminaire, ecrite pour etre honnete et precise. Elle sera completee puis revue
    par un conseil juridique. Pour toute question : <a href="mailto:${CONTACT}">${CONTACT}</a>.
  </div>

  <h2>1. Qui sommes-nous</h2>
  <p>Lancya est un espace de travail base sur l'intelligence artificielle, destine aux professionnels
  qui traitent des informations sensibles. Notre choix de fond : faire tourner l'intelligence
  artificielle et stocker vos fichiers en Suisse. Cette page explique, point par point, quelles
  donnees nous traitons, ou, et par qui.</p>

  <h2>2. Ce que nous pouvons dire honnetement</h2>
  <p>Nous pensons qu'un service de confiance ne survend pas. Voici donc la realite, sans formule
  marketing :</p>
  <ul>
    <li><strong>Le traitement par l'IA a lieu en Suisse</strong> (chez Infomaniak). Vos echanges avec
    l'IA ne sont pas envoyes a des modeles americains.</li>
    <li><strong>Vos fichiers sont stockes en Suisse</strong> (Infomaniak Object Storage).</li>
    <li><strong>Vos contenus ne servent pas a entrainer des modeles.</strong></li>
    <li>En revanche, nous ne pretendons pas que vos donnees seraient invisibles, meme pour nous.
    Comme tout hebergeur, nous avons techniquement acces a l'infrastructure pour faire fonctionner
    le service. Un chiffrement de bout en bout total rendrait l'IA, la recherche et l'analyse de
    documents impossibles. Nous limitons cet acces au strict necessaire et ne consultons pas vos
    contenus en dehors de ce qui est indispensable au fonctionnement ou exige par la loi.</li>
  </ul>

  <h2>3. Donnees que nous traitons</h2>
  <ul>
    <li><strong>Donnees de compte</strong> : adresse e-mail, nom, mot de passe (stocke sous forme chiffree), preferences.</li>
    <li><strong>Contenu</strong> : vos conversations, fichiers televerses et documents generes.</li>
    <li><strong>Donnees techniques</strong> : journaux de connexion, adresse IP, type d'appareil, a des fins de securite.</li>
    <li><strong>Donnees de facturation</strong> : gerees par notre prestataire de paiement (nous ne stockons pas vos donnees de carte).</li>
  </ul>

  <h2>4. Ou se trouve chaque donnee (carte claire)</h2>
  <p>Le coeur de Lancya (l'IA et vos fichiers) est en Suisse. Certaines briques techniques s'appuient
  sur des prestataires europeens ou internationaux. Voici le detail, sans rien cacher :</p>
  <table class="map">
    <tr><th>Traitement</th><th>Prestataire</th><th>Lieu</th></tr>
    <tr><td>Traitement par l'IA (vos messages et documents soumis a l'IA)</td><td>Infomaniak</td><td class="loc flag-ch">Suisse</td></tr>
    <tr><td>Stockage de vos fichiers</td><td>Infomaniak Object Storage</td><td class="loc flag-ch">Suisse</td></tr>
    <tr><td>E-mails du service (verification, mot de passe)</td><td>Infomaniak Mail</td><td class="loc flag-ch">Suisse</td></tr>
    <tr><td>Application, comptes et conversations (base de donnees)</td><td>Railway</td><td class="loc">Europe (EU West)</td></tr>
    <tr><td>Recherche web (lorsque vous l'activez)</td><td>SearXNG auto-heberge (sur Railway)</td><td class="loc">Europe (EU West)</td></tr>
    <tr><td>Paiement et facturation</td><td>Stripe</td><td class="loc">UE / international</td></tr>
  </table>
  <p style="font-size:14px;color:#6b7280;">Note : la recherche web, quand vous l'utilisez, va chercher
  des pages publiques sur Internet ; les requetes correspondantes quittent donc nos serveurs pour
  atteindre les sites consultes. Stripe ne recoit que des donnees de facturation, jamais vos contenus
  metier.</p>
  <p>Nous rapatrions progressivement l'hebergement applicatif, aujourd'hui en Europe, vers la Suisse
  (Infomaniak) : cette migration est prevue dans les prochaines semaines, avec pour objectif d'avoir
  l'ensemble de la chaine en Suisse.</p>

  <h2>5. Finalites</h2>
  <ul>
    <li>Fournir le service (repondre a vos demandes, traiter vos documents).</li>
    <li>Securiser et maintenir la plateforme.</li>
    <li>Gerer votre compte et la facturation.</li>
    <li>Respecter nos obligations legales.</li>
  </ul>

  <h2>6. Securite</h2>
  <p>Chiffrement en transit (TLS) entre vous, l'application et nos prestataires ; isolation des donnees
  par compte (un utilisateur n'accede pas aux donnees d'un autre) ; acces interne limite au strict
  necessaire.</p>

  <h2>7. Conservation et suppression</h2>
  <p>Vous pouvez supprimer vos conversations et vos fichiers a tout moment. A la fermeture de votre
  compte, vos donnees sont supprimees, sous reserve des obligations legales de conservation.</p>

  <h2>8. Vos droits</h2>
  <p>Conformement a la nLPD (loi suisse sur la protection des donnees) et, le cas echeant, au RGPD
  (Union europeenne), vous disposez d'un droit d'acces, de rectification, de suppression et de
  portabilite. Pour les exercer : <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

  <h2>9. Cookies</h2>
  <p>Nous utilisons les cookies strictement necessaires au fonctionnement du service (session,
  authentification). Aucun traceur publicitaire tiers.</p>

  <h2>10. Contact</h2>
  <p>Pour toute question relative a vos donnees : <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
  `,
);

const TERMS = layout(
  "Conditions d'utilisation",
  `
  <h1>Conditions d'utilisation</h1>
  <div class="updated">Derniere mise a jour : ${UPDATED}</div>
  <div class="note">
    Version preliminaire. Ce document sera complete puis revu par un conseil juridique.
    Pour toute question : <a href="mailto:${CONTACT}">${CONTACT}</a>.
  </div>

  <h2>1. Objet</h2>
  <p>Les presentes conditions regissent l'acces et l'utilisation de Lancya. En creant un compte ou
  en utilisant le service, vous les acceptez.</p>

  <h2>2. Description du service</h2>
  <p>Lancya est un espace de travail assiste par intelligence artificielle (conversation, analyse et
  generation de documents). Le traitement par l'IA et le stockage des fichiers ont lieu en Suisse ;
  l'hebergement de l'application et le paiement reposent sur des prestataires europeens ou
  internationaux, detailles dans notre <a href="/confidentialite">politique de confidentialite</a>.</p>

  <h2>3. Compte</h2>
  <p>Vous etes responsable de l'exactitude des informations fournies, de la confidentialite de vos
  identifiants et de l'activite sur votre compte. Vous devez avoir l'age legal requis.</p>

  <h2>4. Usage acceptable</h2>
  <ul>
    <li>Ne pas utiliser le service a des fins illegales ou portant atteinte aux droits de tiers.</li>
    <li>Ne pas tenter de compromettre la securite ou l'integrite de la plateforme.</li>
    <li>Ne pas televerser de contenu pour lequel vous n'avez pas les droits necessaires.</li>
  </ul>

  <h2>5. Votre contenu</h2>
  <p>Vous restez proprietaire des contenus que vous televersez et generez. Vous nous accordez
  uniquement les droits techniques necessaires pour fournir le service (stockage, traitement,
  affichage).</p>

  <h2>6. Nature de l'assistance IA</h2>
  <p>Les reponses produites par l'intelligence artificielle constituent une aide a la reflexion et a
  la redaction. Elles ne constituent pas un conseil juridique, medical, fiscal ou comptable formel.
  Pour toute decision importante, consultez un professionnel qualifie. Vous restez responsable de la
  verification et de l'usage des resultats.</p>

  <h2>7. Disponibilite</h2>
  <p>Nous nous efforcons d'assurer la continuite du service mais ne garantissons pas une disponibilite
  sans interruption. Des operations de maintenance ou des incidents peuvent survenir.</p>

  <h2>8. Limitation de responsabilite</h2>
  <p>Dans les limites permises par la loi, Lancya ne peut etre tenue responsable des dommages
  indirects resultant de l'utilisation ou de l'impossibilite d'utiliser le service.</p>

  <h2>9. Tarifs et paiement</h2>
  <p>Les conditions tarifaires applicables sont celles affichees lors de la souscription. Les
  paiements sont traites par notre prestataire de paiement.</p>

  <h2>10. Resiliation</h2>
  <p>Vous pouvez fermer votre compte a tout moment. Nous pouvons suspendre ou resilier un compte en
  cas de manquement aux presentes conditions.</p>

  <h2>11. Droit applicable</h2>
  <p>Les presentes conditions sont regies par le droit suisse. Tout litige releve des tribunaux
  competents du siege de Lancya, sous reserve des dispositions imperatives applicables.</p>

  <h2>12. Contact</h2>
  <p>Pour toute question : <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
  `,
);

const faq = (q, a, open = false) =>
  `<details class="faq"${open ? ' open' : ''}><summary>${q}</summary><div class="answer">${a}</div></details>`;
const faqCat = (label) => `<div class="faq-cat">${label}</div>`;

const FAQ = layout(
  'Aide et FAQ',
  `
  <h1>Aide et questions fréquentes</h1>
  <div class="updated">Lancya, votre espace de travail IA hébergé en Suisse.</div>
  <div class="note">
    Cliquez sur une question pour voir la réponse. Une question qui n'y figure pas ?
    Écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>.
  </div>

  ${faqCat('Découvrir Lancya')}
  ${faq(
    "Qu'est-ce que Lancya ?",
    `<p>Un assistant basé sur l'intelligence artificielle, pensé pour les professionnels. Vous
    discutez avec lui comme avec un collègue, et il vous aide à rédiger, analyser, calculer et
    produire des documents. Le traitement par l'IA et le stockage de vos fichiers ont lieu en Suisse.</p>`,
    true,
  )}
  ${faq(
    'Quels modèles puis-je utiliser ?',
    `<p>Deux choix dans le sélecteur en haut de la conversation :</p>
    <ul>
      <li><strong>Lancya</strong> : notre modèle principal (Kimi K2), rapide et capable d'utiliser des outils tout seul. Recommandé par défaut.</li>
      <li><strong>Apertus</strong> : le modèle suisse, plus modeste, parfait pour un échange rapide.</li>
    </ul>`,
  )}
  ${faq(
    'Dans quelle langue puis-je écrire ?',
    `<p>Écrivez comme vous parlez, en français le plus souvent. Lancya répond dans votre langue.
    Il comprend aussi l'allemand, l'italien et l'anglais.</p>`,
  )}
  ${faq(
    'Comment bien formuler ma demande ?',
    `<p>Allez à l'essentiel et donnez le contexte utile : à qui s'adresse le texte, le ton voulu,
    la longueur, les éléments à inclure. Vous pouvez toujours répondre « plus court », « plus
    formel » ou « ajoute tel point » pour affiner. Inutile de tout réussir du premier coup.</p>`,
  )}

  ${faqCat('Ce que Lancya sait faire')}
  ${faq(
    'Que sait-il faire concrètement ?',
    `<ul>
      <li><strong>Rédaction</strong> : emails, courriers, comptes rendus, offres, publications.</li>
      <li><strong>Documents</strong> : de vrais fichiers Word, Excel, PowerPoint et PDF, mis en forme et téléchargeables.</li>
      <li><strong>Analyse et calcul</strong> : il exécute du code pour traiter des données, calculer et produire des graphiques.</li>
      <li><strong>Recherche web</strong> : il va chercher des informations à jour quand c'est utile.</li>
      <li><strong>Lecture de vos fichiers</strong> : téléversez un document et posez vos questions dessus.</li>
    </ul>`,
  )}
  ${faq(
    'Peut-il créer des documents Word, Excel, PowerPoint ou PDF ?',
    `<p>Oui. Demandez par exemple un tableau de suivi, une présentation ou un courrier : Lancya
    produit un vrai fichier que vous pouvez prévisualiser puis télécharger. Les tableaux Excel
    s'affichent directement dans une grille interactive.</p>`,
  )}
  ${faq(
    'Peut-il chercher des informations sur le web ?',
    `<p>Oui, quand c'est pertinent il lance une recherche pour vous donner une réponse à jour. Les
    requêtes correspondantes quittent nos serveurs pour atteindre les sites consultés ; vos
    fichiers, eux, ne sont jamais envoyés au web.</p>`,
  )}
  ${faq(
    'Peut-il lire et analyser mes fichiers ?',
    `<p>Oui. Téléversez un PDF, une image, un Word ou un Excel via le trombone, puis interrogez-le :
    résumé, extraction d'informations, analyse de chiffres, vérification, etc.</p>`,
  )}
  ${faq(
    'Que sont les réponses suggérées (boutons cliquables) ?',
    `<p>Quand quelques réponses évidentes feraient gagner du temps, Lancya peut les proposer sous
    forme de boutons. Cliquez pour répondre en un geste, ou écrivez votre propre réponse comme
    d'habitude. Dans certains cas vous pouvez même en cocher plusieurs à la fois.</p>`,
  )}
  ${faq(
    'Comment envoyer un email rédigé par Lancya ?',
    `<p>Lorsqu'il rédige un email, un bouton <strong>Ouvrir dans ma messagerie</strong> apparaît sous
    le texte : il ouvre votre messagerie habituelle avec l'objet et le contenu déjà remplis, prêt à
    envoyer. Vous pouvez aussi simplement copier le texte.</p>`,
  )}

  ${faqCat('Fichiers et documents')}
  ${faq(
    'Comment téléverser un fichier ?',
    `<p>Cliquez sur l'icône trombone dans la barre de message, choisissez votre fichier, puis posez
    votre question. Lancya l'analyse automatiquement.</p>`,
  )}
  ${faq(
    'Quels formats sont acceptés ?',
    `<p>Les formats courants : PDF, images (photo, capture d'écran), Word, Excel, PowerPoint, texte
    et CSV. Pour les images et PDF scannés, Lancya peut aussi lire le texte qu'ils contiennent.</p>`,
  )}
  ${faq(
    'Où retrouver les documents générés ?',
    `<p>Chaque document apparaît directement dans la conversation, avec un aperçu et un bouton de
    téléchargement. Il reste accessible tant que vous gardez la conversation.</p>`,
  )}

  ${faqCat('Skills et agents')}
  ${faq(
    'Que sont les « skills » et les « agents » ?',
    `<p>Les <strong>skills</strong> sont des compétences spécialisées que l'IA mobilise toute seule
    quand le sujet s'y prête (droit du travail suisse, fiscalité, comptabilité, rédaction...). Les
    <strong>agents</strong> sont des assistants pré-configurés (par exemple « Copywriter » ou
    « Assistant RH Suisse ») qui vont droit au but sur une tâche précise.</p>`,
  )}
  ${faq(
    'Comment utiliser un agent ?',
    `<p>Ouvrez la liste des agents, choisissez celui qui correspond à votre besoin, et discutez avec
    lui comme avec l'assistant principal. Il est déjà réglé pour son domaine.</p>`,
  )}

  ${faqCat('Confidentialité et sécurité')}
  ${faq(
    'Mes données sont-elles privées ?',
    `<p>Le traitement par l'IA a lieu en Suisse (Infomaniak) et vos fichiers y sont stockés. Chaque
    compte est isolé des autres, et nous limitons l'accès interne au strict nécessaire. Le détail
    figure dans notre <a href="/confidentialite">politique de confidentialité</a>.</p>`,
  )}
  ${faq(
    "Mes données servent-elles à entraîner l'IA ?",
    `<p>Non. Vos conversations et vos fichiers ne servent jamais à entraîner des modèles.</p>`,
  )}
  ${faq(
    'Où sont hébergées mes données ?',
    `<p>L'IA et vos fichiers sont en Suisse. L'application et la base de données (comptes,
    conversations) sont aujourd'hui en Europe, avec une migration vers la Suisse prévue. Le paiement
    passe par Stripe. La carte complète, traitement par traitement, est dans notre
    <a href="/confidentialite">politique de confidentialité</a>.</p>`,
  )}
  ${faq(
    'Qui peut accéder à mes conversations ?',
    `<p>Vous. Comme tout hébergeur, nous avons techniquement accès à l'infrastructure pour faire
    fonctionner le service, mais nous ne consultons pas vos contenus en dehors de ce qui est
    indispensable au fonctionnement ou exigé par la loi.</p>`,
  )}

  ${faqCat('Compte, forfaits et facturation')}
  ${faq(
    'Comment fonctionnent les forfaits ?',
    `<p>Vous disposez d'un quota de crédits par mois. La part restante s'affiche dans vos réglages.
    Quand elle baisse, un bandeau vous propose de passer à un forfait supérieur.</p>`,
  )}
  ${faq(
    'Comment changer de forfait ?',
    `<p>Depuis vos réglages ou le bandeau de crédits, choisissez le forfait voulu. Le paiement est
    immédiat et vos crédits sont crédités aussitôt, sans engagement de durée.</p>`,
  )}
  ${faq(
    'Comment se passe le paiement ?',
    `<p>Le paiement est traité par Stripe. Nous ne stockons pas vos données de carte. Stripe ne
    reçoit que les informations de facturation, jamais vos contenus.</p>`,
  )}
  ${faq(
    'Puis-je supprimer mes données ou mon compte ?',
    `<p>Oui. Vous pouvez supprimer vos conversations et vos fichiers à tout moment. À la fermeture du
    compte, vos données sont supprimées, sous réserve des obligations légales de conservation.</p>`,
  )}

  ${faqCat("Besoin d'aide ?")}
  ${faq(
    'Une question, un souci ?',
    `<p>Écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>, nous répondons.</p>`,
  )}
  `,
);

const sendPage = (html) => (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
};

router.get('/confidentialite', sendPage(PRIVACY));
router.get('/conditions', sendPage(TERMS));
router.get('/aide', sendPage(FAQ));

module.exports = router;
