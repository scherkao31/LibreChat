---
name: meeting-notes
description: "Transforme des notes brutes, une transcription ou un resume de reunion en un compte rendu clair et structure : synthese, points cles, decisions, actions avec responsable et echeance, prochaines etapes. Adapte le format au type de reunion (point d'equipe, revue de projet, appel client, brainstorming) et au niveau de detail voulu. Utiliser cette skill des que l'utilisateur veut organiser des notes de reunion, rediger un proces-verbal, extraire les decisions et les actions, ou resumer une discussion. Ne pas utiliser pour rediger un email ou une lettre (autre skill)."
when-to-use: "L'utilisateur veut transformer des notes ou une transcription de reunion en compte rendu structure (decisions, actions, responsables, echeances)."
always-apply: false
---

# Compte rendu de reunion

Tu transformes des notes brutes, une transcription ou un resume de reunion en documentation claire et exploitable : decisions, actions, points cles.

## Methode

1. Demande, si ce n'est pas clair, le **type de reunion** (point d'equipe, revue de projet, appel client, brainstorming) et le **niveau de detail** voulu (synthese executive, standard, detaille).
2. Produis un compte rendu structure, fidele a ce qui a ete dit.
3. Mets en avant les **decisions** et les **actions** (avec responsable et echeance), c'est ce que les gens cherchent en premier.

## Extraire les actions

Reperer les formulations de tache : "il faut...", "quelqu'un doit...", "peux-tu...", "on va...", un nom suivi d'un verbe ("Marie prepare..."), une echeance mentionnee avec une tache.

## Identifier les decisions

Reperer : "on a decide...", "la decision est...", "desormais on...", "valide", "d'accord sur...", le langage de consensus ("tout le monde est d'accord...").

## Determiner les responsables

Nomme explicitement ("Sarah s'en occupe..."), par role ("l'equipe design..."), sinon attribuer par defaut a l'organisateur et **signaler les actions non attribuees** pour suivi.

## Modeles

### Compte rendu standard

```markdown
# Compte rendu : [Titre]

Date : [date]
Participants : [noms]
Duree : [temps]

## Objet
[Une phrase qui resume l'objectif de la reunion]

## Points discutes
1. [Sujet 1]
   - [point]
2. [Sujet 2]
   - [point]

## Decisions
- [Decision 1]
- [Decision 2]

## Actions
| Action | Responsable | Echeance | Statut |
|--------|-------------|----------|--------|
| [tache] | [nom] | [date] | A faire |

## Prochaines etapes
- [prochaine reunion ou jalon]
```

### Point d'equipe (standup)

```markdown
# Point d'equipe - [date]

## [Personne 1]
Hier : [fait]
Aujourd'hui : [prevu]
Blocages : [le cas echeant]

## Blocages a remonter
- [blocage necessitant une escalade]

## Annonces
- [info pour toute l'equipe]
```

### Reunion client

```markdown
# Compte rendu - reunion client

Client : [nom]
Date : [date]
Cote nous : [noms]
Cote client : [noms]

## Objet
[pourquoi cette reunion]

## Retours et demandes du client
1. [retour]
2. [demande]

## Nos engagements
- [ce qu'on a promis, et le delai]

## Engagements du client
- [ce qu'il fournit, et le delai]

## Suivi
| Action | Responsable | Echeance |
|--------|-------------|----------|
| [tache] | [nom] | [date] |

## Prochaine reunion
[date / ordre du jour pressenti]
```

### Revue de projet

```markdown
# Revue de projet : [nom]

Date : [date]
Phase : [phase]
Statut : sur les rails / a risque / en retard

## Avancement
- Termine : [jalons atteints]
- En cours : [travaux]
- A venir : [prochains jalons]

## Indicateurs
| Indicateur | Cible | Reel | Statut |
|------------|-------|------|--------|
| [KPI] | [cible] | [reel] | ok / a surveiller / non atteint |

## Risques et problemes
| Risque | Impact | Mesure | Responsable |
|--------|--------|--------|-------------|
| [description] | eleve/moyen/faible | [plan] | [nom] |

## Decisions a prendre
- [decision a escalader]

## Actions
- [ ] [tache] - [responsable] - echeance : [date]
```

## Format de restitution par defaut

```markdown
## Compte rendu : [Titre]

Date : [date]
Participants : [liste]

### Synthese
[2 a 3 phrases]

### Points cles
1. [point]
2. [point]

### Decisions
- [decision]

### Actions
| # | Action | Responsable | Echeance | Priorite |
|---|--------|-------------|----------|----------|
| 1 | [tache] | [nom] | [date] | haute/moyenne/basse |

### Prochaines etapes
- [prochaine reunion ou jalon]

### A traiter plus tard
- [points en suspens]
```

## Options et limites

- Adapte le format (puces, tableau, prose, PV formel), le niveau de detail et le focus (actions seules, decisions seules, ou complet) selon la demande.
- La qualite depend de celle des notes fournies. Demande des precisions sur les pronoms ou acronymes ambigus plutot que de deviner.
- Tu ne peux pas verifier les engagements ni les delais : invite l'utilisateur a relire avant diffusion.
- Reponds dans la langue de l'utilisateur.
