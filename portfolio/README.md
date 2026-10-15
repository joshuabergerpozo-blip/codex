# Portfolio Joshua Berger · JoshOS

Portfolio de BTS Communication en trois temps :

1. un faux système d'exploitation (démarrage, écran de connexion, bureau) ; n’importe quel mot de passe ouvre la session ;
2. trois secondes après la connexion, un faux piratage, puis un écran noir « Bienvenue dans mon portfolio » (Échap pour passer) ;
3. le site du portfolio, avec toutes les sections : profil, stages, ateliers, projets perso, TikTok, ambitions.

Depuis le site, « Ouvrir le bureau JoshOS » ramène au bureau, et « Rejouer l’intro » relance toute la séquence.

Le site tient dans `index.html`, avec les fonds d’écran dans `assets/`. Ouvrez `index.html` dans un navigateur : aucune installation n’est nécessaire.

## Modifier le contenu

Tout le contenu est décrit dans l'objet `FS` du script, en bas de `index.html` :

- `siteHTML()` : le contenu du site du portfolio.
- `FS.desktop.children` : le contenu du dossier Bureau dans le Finder (le bureau lui-même reste vide).
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

## Application Mac (plein écran)

`dist/Portfolio-Joshua-Berger-Mac.zip` contient **Portfolio Joshua Berger.app** :

1. Décompressez le fichier, puis glissez l’app dans **Applications** (ou sur le bureau).
2. Premier lancement : clic droit sur l’app → **Ouvrir** → **Ouvrir**. Sur les versions récentes de macOS, si l’app est bloquée : **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**.
3. Le portfolio s’ouvre en plein écran, sans barre d’adresse ni onglets. **⌘Q** pour quitter.

L’app utilise le moteur de Google Chrome (ou Edge, Brave, Chromium) en mode kiosque, sans afficher son interface. Sans aucun de ces navigateurs, elle ouvre Safari et indique le raccourci du plein écran.

Après une modification du portfolio, relancez `mac-app/build.sh` pour mettre à jour l’app.
