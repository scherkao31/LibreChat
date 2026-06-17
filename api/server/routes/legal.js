const express = require('express');

const router = express.Router();

/**
 * Pages legales Lancya servies cote serveur (hors SPA) pour que
 * https://www.lancya.ch/confidentialite et /conditions repondent par de vraies
 * pages HTML autonomes (referencees dans l'ecran de consentement Google OAuth
 * et le pied de page de l'app). Contenu v1, a enrichir + faire relire par un juriste.
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
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line);
    color:var(--muted); font-size:13.5px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  footer a { color:var(--muted); text-decoration:none; }
  footer a:hover { text-decoration:underline; }
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
    Version preliminaire. Ce document decrit nos pratiques actuelles et sera complete puis
    revu par un conseil juridique. Pour toute question : <a href="mailto:${CONTACT}">${CONTACT}</a>.
  </div>

  <h2>1. Qui sommes-nous</h2>
  <p>Lancya est un espace de travail base sur l'intelligence artificielle, concu pour les
  professionnels suisses et europeens qui traitent des informations sensibles. L'inference IA et
  le stockage des fichiers sont assures en Suisse par Infomaniak.</p>

  <h2>2. Donnees que nous traitons</h2>
  <ul>
    <li><strong>Donnees de compte</strong> : adresse e-mail, nom, mot de passe (sous forme chiffree), preferences.</li>
    <li><strong>Contenu</strong> : vos conversations, fichiers televerses et documents generes.</li>
    <li><strong>Donnees techniques</strong> : journaux de connexion, adresse IP, type d'appareil, a des fins de securite et de bon fonctionnement.</li>
    <li><strong>Donnees de facturation</strong> : gerees par notre prestataire de paiement (nous ne stockons pas vos donnees de carte).</li>
  </ul>

  <h2>3. Finalites</h2>
  <ul>
    <li>Fournir le service (repondre a vos demandes, traiter vos documents).</li>
    <li>Securiser et maintenir la plateforme.</li>
    <li>Gerer votre compte et la facturation.</li>
    <li>Respecter nos obligations legales.</li>
  </ul>

  <h2>4. Hebergement et localisation</h2>
  <p>L'inference IA et le stockage de vos fichiers sont realises en <strong>Suisse</strong> (Infomaniak).
  Certaines briques techniques (hebergement applicatif, paiement) s'appuient sur des prestataires
  europeens ou internationaux, listes ci-dessous et encadres par contrat. Nous ne pretendons pas
  un chiffrement de bout en bout qui rendrait le contenu invisible meme pour nous : faire fonctionner
  l'IA suppose que le contenu soit lisible au moment du traitement, en Suisse.</p>

  <h2>5. Pas d'entrainement sur vos donnees</h2>
  <p>Vos contenus ne sont pas utilises pour entrainer des modeles d'intelligence artificielle.</p>

  <h2>6. Sous-traitants</h2>
  <ul>
    <li><strong>Infomaniak</strong> (Suisse) : inference IA et stockage des fichiers.</li>
    <li><strong>Railway</strong> : hebergement de l'application.</li>
    <li><strong>Stripe</strong> : traitement des paiements.</li>
  </ul>
  <p>La liste detaillee et a jour des sous-traitants sera publiee et tenue a disposition.</p>

  <h2>7. Securite</h2>
  <p>Chiffrement en transit (TLS), isolation des donnees par compte (un utilisateur n'accede pas aux
  donnees d'un autre), acces interne limite au strict necessaire pour faire fonctionner le service.</p>

  <h2>8. Conservation et suppression</h2>
  <p>Vous pouvez supprimer vos conversations et vos fichiers. A la fermeture de votre compte, vos
  donnees sont supprimees, sous reserve des obligations legales de conservation.</p>

  <h2>9. Vos droits</h2>
  <p>Conformement a la nLPD (Suisse) et, le cas echeant, au RGPD (Union europeenne), vous disposez
  d'un droit d'acces, de rectification, de suppression et de portabilite de vos donnees. Pour les
  exercer : <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

  <h2>10. Cookies</h2>
  <p>Nous utilisons les cookies strictement necessaires au fonctionnement du service (session,
  authentification). Aucun traceur publicitaire tiers n'est utilise.</p>

  <h2>11. Contact</h2>
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
  generation de documents) heberge en Suisse.</p>

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

const sendPage = (html) => (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
};

router.get('/confidentialite', sendPage(PRIVACY));
router.get('/conditions', sendPage(TERMS));

module.exports = router;
