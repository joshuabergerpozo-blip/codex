# Portfolio Joshua Berger · JoshOS

Portfolio de BTS Communication présenté comme un faux système d'exploitation :
bureau, dossiers, fenêtres déplaçables, dock, corbeille, recherche et terminal.

Le site tient dans `index.html`, avec les fonds d’écran dans `assets/`. Ouvrez `index.html` dans un navigateur : aucune installation n’est nécessaire.

## Modifier le contenu

Tout le contenu est décrit dans l'objet `FS` du script, en bas de `index.html` :

- `FS.desktop.children` : les icônes affichées sur le bureau, dans l'ordre.
- Chaque dossier (`stages`, `ateliers`, `perso`, `trash`) a une liste `children`.
- Chaque fichier a un `name`, un `desc` (une phrase), un `status`
  (`live`, `done`, `stop`, `pause`, `soon`), un `cat` (le texte affiché par la commande
  `cat` dans le Terminal) et une fonction `render()` qui renvoie le contenu de sa fenêtre.

Pour ajouter un projet, copiez une entrée existante (par exemple `coworking`), changez
son identifiant et son contenu, puis ajoutez cet identifiant dans le `children` du dossier voulu.

## À compléter

- `stage2` : stage de 2e année.
- `heinz` : projet d'atelier Heinz × Absolut.
- `coworking` : vidéos et posters (les cadres « à intégrer »).

## Mettre en ligne

Le dossier `portfolio/` peut être publié tel quel sur GitHub Pages, Netlify ou Vercel.
