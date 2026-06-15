---
name: Presentations HTML (slides)
description: "Cree des presentations HTML elegantes et interactives avec reveal.js (le framework de slides web le plus repandu) : titres, listes, images, code colorise, notes d'orateur, transitions. Utiliser cette skill des que l'utilisateur demande une presentation, un slide deck, des diapositives, un pitch, un support de presentation, ou veut transformer des points / un document en slides. Toujours rendre le resultat sous forme d'artifact HTML. Ne pas utiliser pour un simple document texte ou un PDF (utiliser les artifacts document a la place)."
when-to-use: L'utilisateur veut une presentation, des slides, des diapositives, un pitch deck ou un support visuel a presenter.
always-apply: false
---

# Presentations HTML avec reveal.js

Tu crees des **presentations HTML autonomes** avec **reveal.js**. Le rendu se fait dans un **artifact HTML** (un seul fichier `text/html`), affiche dans le panneau et telechargeable.

## Regles de production

1. **Toujours produire un seul fichier HTML autonome** (reveal.js charge depuis le CDN), dans un artifact HTML.
2. **Une idee par slide.** Titres courts, listes concises, pas de paragraphes denses.
3. Utilise des **notes d'orateur** (`<aside class="notes">`) quand c'est utile.
4. Pour du code, utilise `<pre><code>` (coloration automatique).
5. **Style Lancya** par defaut : fond clair, accents en **rouge #DA291C**, typo sobre. Adapte si l'utilisateur demande autre chose.
6. Demande le **sujet, le public et le nombre de slides** si ce n'est pas clair.

## Squelette a adapter

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/white.css" />
  <style>
    :root { --r-link-color: #DA291C; }
    .reveal h1, .reveal h2 { color: #1a1a1a; }
    .reveal .accent { color: #DA291C; }
    .reveal { font-family: Helvetica, Arial, sans-serif; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section>
        <h1>Titre de la <span class="accent">presentation</span></h1>
        <p>Sous-titre ou auteur</p>
      </section>
      <section>
        <h2>Un point cle</h2>
        <ul>
          <li>Idee 1</li>
          <li>Idee 2</li>
        </ul>
        <aside class="notes">Notes pour l'orateur, non visibles a l'ecran.</aside>
      </section>
      <section>
        <section><h2>Section a slides verticaux</h2></section>
        <section><p>Detail qui se devoile en descendant.</p></section>
      </section>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script>
    Reveal.initialize({ hash: true, slideNumber: true, transition: 'slide' });
  </script>
</body>
</html>
```

## Rappels

- `<section>` = une slide horizontale ; un `<section>` qui contient d'autres `<section>` = des slides verticaux.
- Transitions possibles : `slide`, `fade`, `convex`, `zoom`, `none`.
- Themes alternatifs : remplace `white.css` par `black.css`, `league.css`, `serif.css`, etc.
- Garde tout dans **un seul fichier** pour que l'artifact se rende correctement.
