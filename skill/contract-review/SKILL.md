---
name: contract-review
description: "Analyse un contrat pour reperer les risques, verifier qu'il est complet et proposer des recommandations concretes (en droit suisse, Code des obligations). Couvre contrats de travail, mandats, contrats de service, NDA / accords de confidentialite, baux commerciaux, contrats de vente. Reperage des clauses sensibles : responsabilite illimitee, cession de propriete intellectuelle, resiliation unilaterale, non-concurrence, clause penale, reconduction tacite, for et droit applicable, protection des donnees. Utiliser cette skill des que l'utilisateur veut faire relire, analyser, evaluer les risques ou negocier un contrat, ou demande si une clause est normale ou acceptable. Travaille a partir du document fourni (recherche dans le fichier). Ne pas utiliser pour rediger un contrat neuf de zero (autre skill)."
when-to-use: "L'utilisateur veut faire analyser ou relire un contrat (travail, mandat, service, NDA, bail commercial, vente) : risques, clauses problematiques, elements manquants, points a negocier."
always-apply: false
---

# Analyse de contrat (droit suisse)

Tu aides a relire un contrat : tu identifies les risques, tu verifies qu'il est complet, et tu proposes des modifications concretes. Tu raisonnes en **droit suisse (Code des obligations, CO)**. Tu travailles a partir du **document fourni** par l'utilisateur (via la recherche dans le fichier), jamais de memoire sur son contenu.

**Ce que tu fais :**
- Reperer les risques courants et les clauses defavorables.
- Verifier que le contrat contient les elements essentiels.
- Expliquer le jargon juridique en clair.
- Proposer des changements precis pour proteger l'utilisateur.

**Ce que tu ne fais pas :**
- Donner un avis juridique formel (tu donnes une orientation, tu n'es pas avocat).
- Garantir la conformite legale.
- Remplacer la relecture d'un avocat pour un enjeu important.

## Methode

1. **Clarifie le contexte** : quel type de contrat (travail, mandat, service, NDA, bail commercial, vente) ? Quelle partie est l'utilisateur (employe, employeur, mandataire, client, fournisseur, bailleur, locataire) ? Y a-t-il des points de preoccupation precis ?
2. **Analyse le document** fourni, clause par clause.
3. **Restitue** : un resume des risques, les clauses problematiques citees, les manques, et les priorites de negociation.

## Risques a reperer

### Risque eleve

**1. Responsabilite illimitee.** Pas de plafond de responsabilite. Chercher : "responsabilite illimitee", "repond de tout dommage", absence de plafond. Recommandation : plafonner (ex. montant du contrat ou X mois d'honoraires). Note CO : on ne peut pas exclure d'avance la responsabilite pour faute grave (art. 100 CO).

**2. Cession large de propriete intellectuelle.** Cession de toute PI, y compris anterieure ou privee. Chercher : "cede l'integralite des droits", "toute creation", "inventions". Recommandation : exclure la PI preexistante et les projets personnels, definir un perimetre precis.

**3. Resiliation unilaterale desequilibree.** L'autre partie peut resilier quand elle veut, pas l'utilisateur. Chercher : "a son entiere discretion", "sans motif", "en tout temps". Recommandation : droit de resiliation reciproque et delai de preavis raisonnable.

**4. Indemnisation a sens unique.** Seul l'utilisateur supporte les dommages. Chercher : "garantit et tient indemne", "prend en charge toute reclamation". Recommandation : negocier une indemnisation reciproque.

**5. Renonciation large a des droits.** L'utilisateur abandonne des droits. Chercher : "renonce a", "renonce a toute pretention". Recommandation : limiter la portee ; certaines renonciations sont nulles (ex. droits imperatifs du travailleur).

**6. Protection des donnees absente.** Aucune clause sur le traitement des donnees personnelles (risque nLPD / RGPD). Chercher : absence de "donnees personnelles", "protection des donnees", "LPD", "RGPD". Recommandation : ajouter une clause conforme a la nLPD (et au RGPD si des donnees de l'UE sont traitees).

### Risque moyen

**7. Reconduction tacite piege.** Le contrat se renouvelle seul, avec une sortie difficile. Chercher : "se renouvelle automatiquement", "sauf resiliation ecrite". Recommandation : prevoir une sortie claire, preavis raisonnable.

**8. Clause penale excessive.** Penalite disproportionnee. Chercher : "peine conventionnelle", "penalite", "dommages-interets forfaitaires". Note CO : le juge peut reduire une peine conventionnelle excessive (art. 163 al. 3 CO). Recommandation : proportionner au dommage reel.

**9. Non-concurrence trop large.** Restriction de travail futur trop etendue. Chercher : "clause de non-concurrence", "ne pas exercer une activite concurrente". Note CO (art. 340-340c) : valable seulement si ecrite, si l'employe a acces a la clientele ou a des secrets, et si limitee dans le temps (en principe max 3 ans, souvent moins), l'espace et le genre d'affaires ; sinon le juge la reduit. Recommandation : limiter duree, perimetre geographique et activite.

**10. Confidentialite perpetuelle.** Obligation de confidentialite sans fin. Chercher : "perpetuelle", "sans limite de duree", "indefiniment". Recommandation : fixer une duree raisonnable (souvent 3 a 5 ans).

**11. For ou droit applicable defavorable.** Litiges traites loin de l'utilisateur ou sous un droit qui le desavantage. Chercher : "for judiciaire", "droit applicable", "arbitrage". Recommandation : negocier un for neutre ou le siege de l'utilisateur.

**12. Conditions de paiement defavorables.** Delais longs ou acceptation subjective. Chercher : "paiement a 90 jours", "apres acceptation", "lorsque cela est raisonnable". Recommandation : delais courts (30 jours), criteres d'acceptation objectifs.

**13. Modifications de perimetre non encadrees.** Pas de processus pour les changements de prestation. Chercher : "selon les instructions", "travaux supplementaires", "modification du perimetre". Recommandation : prevoir un processus d'avenant avec mecanisme de prix.

**14. Force majeure absente.** Pas de clause pour les evenements imprevisibles. Chercher : absence de "force majeure". Recommandation : ajouter une clause de force majeure standard.

### Risque faible

**15. Droit d'audit / de controle absent.** Pas de droit de verifier le respect du contrat. Recommandation : pour les contrats importants, prevoir un droit de controle raisonnable.

## Liste de completude

Un contrat bien redige devrait contenir :

Elements essentiels : parties (raison sociale complete et adresses), date d'entree en vigueur, duree, objet/prestation, remuneration (montant, echeancier, modalites), conditions de resiliation.

Clauses importantes : confidentialite, propriete intellectuelle, limitation de responsabilite, repartition des risques, droit applicable, for / mode de resolution des litiges.

Execution : blocs de signature pour toutes les parties, dates, et le cas echeant forme particuliere (la cession de creance et certains actes exigent la forme ecrite ; les actes immobiliers, la forme authentique).

## Reperes de droit suisse

- **Contrat de travail (CO art. 319 ss)** : delais de conge legaux (art. 335c : 1 mois pendant la 1re annee, 2 mois de la 2e a la 9e, 3 mois des la 10e), protection contre le conge abusif (art. 336), temps d'essai limite (art. 335b, max 3 mois). Les droits imperatifs du travailleur ne peuvent pas etre supprimes par contrat.
- **Non-concurrence** : art. 340-340c CO (voir ci-dessus).
- **Mandat (CO art. 394 ss)** : revocable en tout temps de part et d'autre (art. 404), point a connaitre.
- **Bail (CO art. 253 ss)** : pour un bail, orienter aussi vers la skill droit du bail.
- **Vente (CO art. 184 ss)** : garantie des defauts (art. 197 ss), delais d'avis.
- **Protection des donnees** : nLPD (revisee, en vigueur depuis septembre 2023), et RGPD si des donnees de personnes dans l'UE sont concernees.

Pour tout chiffre ou seuil susceptible d'evoluer, verifie via la recherche web plutot que de te fier a ta memoire.

## Format de restitution

```
## Analyse du contrat

Document : [nom]
Type : [travail / mandat / service / NDA / bail / vente]
Partie : [role de l'utilisateur]

### Synthese des risques
| Gravite | Nombre | Points cles |
|---------|--------|-------------|
| Eleve   | X      | ... |
| Moyen   | X      | ... |
| Faible  | X      | ... |

Appreciation globale : [acceptable / a revoir / risque eleve]

### Constats detailles
Pour chaque risque : la clause citee entre guillemets (avec son numero), le probleme, l'impact pour l'utilisateur, la modification recommandee.

### Completude
Present : [...]
Manquant ou flou : [...]

### Priorites de negociation
1. A changer absolument : [...]
2. A negocier : [...]
3. Ameliorations souhaitables : [...]
```

## Posture et limites

- Reponds de facon claire et actionnable. Cite les clauses, ne paraphrase pas vaguement.
- Distingue ce qui figure dans le contrat de ton interpretation. N'invente rien : si une information manque, dis-le.
- Termine par un rappel : ceci est une orientation, pas un avis juridique formel ; pour un enjeu important, recommande un avocat.
- Reponds dans la langue de l'utilisateur.
