---
name: html-slides
description: "Cree des presentations HTML elegantes et interactives avec reveal.js (le framework de slides web le plus repandu) : themes, transitions, fragments animes, coloration de code, notes d'orateur, fonds (couleur, image, video, degrade), auto-animate, slides verticaux et Markdown. Utiliser cette skill des que l'utilisateur demande une presentation, un slide deck, des diapositives, un pitch, un support de presentation, un deroule visuel, ou veut transformer des points / un document en slides. Toujours rendre le resultat sous forme d'artifact HTML (un seul fichier autonome). Ne pas utiliser pour un simple document texte, un tableur ou un PDF (utiliser les artifacts document a la place)."
when-to-use: "L'utilisateur veut une presentation, des slides, des diapositives, un pitch deck ou un support visuel a presenter (avec ou sans animations, code, notes d'orateur)."
always-apply: false
---

# Presentations HTML avec reveal.js

Tu crees des **presentations HTML autonomes** avec **reveal.js**, le framework de slides web le plus repandu. Le rendu se fait dans un **artifact HTML** (un seul fichier `text/html`), affiche dans le panneau et telechargeable. Objectif : produire les **meilleures slides possibles** pour le sujet et le public de l'utilisateur.

## Comment proceder

1. Si ce n'est pas clair, demande le **sujet**, le **public** et le **nombre de slides** souhaite. Demande aussi le **ton/theme** (clair ou sombre, sobre ou audacieux) et s'il faut du **code**, des **animations** ou des **notes d'orateur**.
2. Produis **un seul fichier HTML autonome** (reveal.js charge depuis le CDN jsDelivr), dans un artifact HTML.
3. **Adapte le style au sujet et a la marque de l'utilisateur**, pas a une marque imposee. S'il fournit des couleurs ou un logo, utilise-les ; sinon choisis une palette sobre et professionnelle adaptee au theme.
4. Applique les **principes de design** ci-dessous : c'est ce qui distingue une bonne presentation d'un mur de texte.

## Principes de design (vise l'excellence)

- **Une idee par slide.** Le titre porte le message ; le reste l'illustre.
- **Peu de texte.** Vise ~6 puces max, ~6 mots chacune. Le detail va dans les **notes d'orateur**, pas sur le slide.
- **Hierarchie visuelle.** Gros titres, fort contraste, beaucoup d'espace blanc. Le regard doit savoir ou aller en une seconde.
- **Une seule couleur d'accent**, le reste en neutres. Cohérente sur tout le deck. Adapte-la au sujet ou a la marque fournie.
- **Typographie lisible** : sans-serif, taille genereuse (le texte doit se lire au fond d'une salle).
- **Visuels plutot que paragraphes** : schemas, chiffres-cles en grand, images plein cadre.
- **Animations avec parcimonie** : les fragments servent a **reveler progressivement**, pas a decorer.
- **Structure** : slide de titre -> agenda -> corps (un message par slide) -> conclusion / contact.

## Squelette minimal

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/white.css" />
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section>Slide 1</section>
      <section>Slide 2</section>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script>Reveal.initialize();</script>
</body>
</html>
```

## Connaissances reveal.js

### Structure des slides

```html
<!-- Slides horizontaux -->
<section>Slide 1</section>
<section>Slide 2</section>

<!-- Slides verticaux (imbriques : on descend pour les detailler) -->
<section>
  <section>Vertical 1</section>
  <section>Vertical 2</section>
</section>

<!-- Slides en Markdown -->
<section data-markdown>
  <textarea data-template>
    ## Titre du slide
    - Point 1
    - Point 2
  </textarea>
</section>
```

### Themes integres

`black`, `white`, `league`, `beige`, `sky`, `night`, `serif`, `simple`, `solarized`, `blood`, `moon`. On change de theme en changeant la feuille de style :

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/night.css" />
```

Pour un rendu sur-mesure, partir d'un theme proche (`white` ou `black`) et surcharger en CSS.

### Transitions

```javascript
Reveal.initialize({
  transition: 'slide',          // none, fade, slide, convex, concave, zoom
  transitionSpeed: 'default',   // default, fast, slow
  backgroundTransition: 'fade'
});
```

### Fragments (animations a l'interieur d'un slide)

```html
<section>
  <p class="fragment">Apparait en premier</p>
  <p class="fragment fade-up">Puis celui-ci</p>
  <p class="fragment highlight-red">Mise en avant</p>
</section>
```

Styles de fragment : `fade-in`, `fade-out`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `highlight-red`, `highlight-blue`, `highlight-green`, `strike`.

### Coloration de code

```html
<section>
  <pre><code data-trim data-line-numbers="1|3-4">
def hello():
    print("Hello")
    print("World")
    return True
  </code></pre>
</section>
```

`data-line-numbers="1|3-4"` met en surbrillance la ligne 1, puis les lignes 3-4 (revele progressivement). Necessite le plugin `RevealHighlight` (voir exemple 1).

### Notes d'orateur

```html
<section>
  <h2>Titre</h2>
  <p>Contenu</p>
  <aside class="notes">Notes pour l'orateur, visibles avec la touche 'S'.</aside>
</section>
```

Necessite le plugin `RevealNotes`.

### Fonds de slide

```html
<section data-background-color="#1e293b">                          <!-- couleur -->
<section data-background-image="image.jpg" data-background-size="cover">  <!-- image -->
<section data-background-video="video.mp4">                        <!-- video -->
<section data-background-gradient="linear-gradient(to bottom, #0f172a, #1e293b)">  <!-- degrade -->
```

### auto-animate (transition fluide entre deux slides)

Deux `<section data-auto-animate>` consecutifs : reveal.js anime automatiquement les elements partages (memes `data-id`, ou meme texte) d'un slide a l'autre.

```html
<section data-auto-animate>
  <h2>Notre solution</h2>
  <div data-id="box" style="background:#2563eb;padding:20px;">Automatisation</div>
</section>
<section data-auto-animate>
  <h2>Notre solution</h2>
  <div data-id="box" style="background:#2563eb;padding:40px;width:400px;">
    <p>Automatisation</p><p>90% plus rapide</p>
  </div>
</section>
```

### Configuration complete

```javascript
Reveal.initialize({
  // Controles d'affichage
  controls: true, progress: true, slideNumber: true,
  // Comportement
  hash: true, history: true, keyboard: true, overview: true, center: true, touch: true, loop: false,
  // Defilement automatique
  autoSlide: 0, autoSlideStoppable: true,   // autoSlide en ms, 0 = desactive
  // Dimensions de reference
  width: 960, height: 700, margin: 0.04, minScale: 0.2, maxScale: 2.0,
  // Plugins (a charger via <script> + declarer ici)
  plugins: [RevealMarkdown, RevealHighlight, RevealNotes]
});
```

## Exemples complets

### Exemple 1 : presentation technique (theme sombre + code + notes)

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Bonnes pratiques d'API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/night.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/monokai.css" />
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section data-background-gradient="linear-gradient(to bottom right, #1a1a2e, #16213e)">
        <h1>Design d'API</h1>
        <h3>Bonnes pratiques</h3>
        <p><small>Equipe Ingenierie</small></p>
      </section>
      <section>
        <h2>Au programme</h2>
        <ol>
          <li class="fragment">Principes REST</li>
          <li class="fragment">Authentification</li>
          <li class="fragment">Gestion des erreurs</li>
        </ol>
      </section>
      <section>
        <section><h2>Principes REST</h2></section>
        <section>
          <h3>Nommage des ressources</h3>
          <pre><code data-trim class="language-http">
GET /users           # Collection
GET /users/123       # Une ressource
POST /users          # Creer
PUT /users/123       # Mettre a jour
DELETE /users/123    # Supprimer
          </code></pre>
          <aside class="notes">Insister sur la coherence du nommage.</aside>
        </section>
      </section>
      <section><h2>Questions ?</h2></section>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/highlight/highlight.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/plugin/notes/notes.js"></script>
  <script>Reveal.initialize({ hash: true, plugins: [RevealHighlight, RevealNotes] });</script>
</body>
</html>
```

### Exemple 2 : lancement produit (theme clair, chiffre-cle, auto-animate)

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Lancement produit</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/white.css" />
  <style>
    .reveal h1, .reveal h2 { color: #0f172a; }
    .reveal .metric { font-size: 3em; color: #2563eb; font-weight: 700; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section data-background-color="#f8fafc">
        <h1>Voici</h1>
        <h2 style="color:#2563eb;">ProduitX 2.0</h2>
      </section>
      <section>
        <h2>Le probleme</h2>
        <p class="fragment">Les equipes perdent <span class="metric">20%</span> de leur temps sur des taches manuelles.</p>
      </section>
      <section data-auto-animate>
        <h2>Notre solution</h2>
        <div data-id="box" style="background:#2563eb;color:#fff;padding:20px;border-radius:12px;">Automatisation par l'IA</div>
      </section>
      <section data-auto-animate>
        <h2>Notre solution</h2>
        <div data-id="box" style="background:#16a34a;color:#fff;padding:40px;border-radius:12px;width:420px;margin:auto;">
          <p>Automatisation par l'IA</p><p>90% plus rapide</p>
        </div>
      </section>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script>Reveal.initialize({ hash: true, slideNumber: true, transition: 'slide' });</script>
</body>
</html>
```

## Rappels

- Garde **tout dans un seul fichier** pour que l'artifact se rende correctement (reveal.js depuis le CDN, styles en `<style>`).
- Un `<section>` = un slide horizontal ; un `<section>` qui contient d'autres `<section>` = des slides verticaux.
- Pour charger un plugin (code, notes, markdown), il faut **a la fois** le `<script>` du plugin **et** le declarer dans `plugins: [...]`.
- Ressources : reveal.js (https://revealjs.com/), demo (https://revealjs.com/demo/).
