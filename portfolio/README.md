# Portfolio Joshua Berger · JoshOS

Portfolio de BTS Communication en trois temps :

1. un faux système d'exploitation (démarrage, écran de connexion, bureau) ; n’importe quel mot de passe ouvre la session ;
2. trois secondes après la connexion, un faux piratage, puis un écran noir « Bienvenue dans mon portfolio » (Échap pour passer) ;
3. le portfolio sous forme de **dossier E6 déchiffré par le pirate** : un fichier par partie, dans l'ordre attendu par l'épreuve.
   - `00_identite.txt` : l'en-tête E6 (étudiant, établissement, session) et une présentation ;
   - `01_tableau_synoptique.xls` : le tableau synoptique (annonceur, intitulé, support, période, conditions), filtrable par support. Un clic sur une ligne ouvre le détail de la production ;
   - `02` à `04` : les fiches descriptives de situation professionnelle (stage à Hossegor, coworkings beauté, TikTok), avec toutes les rubriques du document officiel ;
   - `05_ateliers.key`, `06_profil_ambitions.txt`, puis `07_pirate.exe` : la révélation finale.

   Les informations encore inconnues sont marquées « À préciser ». Un petit message du pirate commente chaque fichier.

Le « Voyage 3D » (les environnements réalistes) et la « Version site web » restent accessibles depuis le dossier. « Bureau » ramène au bureau, et « Rejouer l’intro » relance toute la séquence.

Le site tient dans `index.html`, avec les fonds d’écran dans `assets/`. Ouvrez `index.html` dans un navigateur : aucune installation n’est nécessaire.

## Les environnements 3D

Chaque environnement est une photo (`assets/env/<nom>.webp`) et sa carte de profondeur (`assets/env/<nom>-depth.png`, blanc = proche). Le moteur WebGL avance dans la photo selon cette profondeur, puis passe à l’environnement suivant par un fondu qui part du centre. Le studio du SaaS est dessiné par le script (`uTechScene()`).

- `U_ENV` : le point de fuite et les particules de chaque environnement.
- `UZ` : l’environnement par défaut de chaque section. Un panneau peut le changer avec `env: '<nom>'` dans `uData()`.
- `assets/env/env-data.js` reprend les images en data URI pour que le portfolio fonctionne aussi en double-cliquant sur `index.html`. Après avoir changé une image, régénérez-le avec `python3 tools/env-data.py`.

Les photos des environnements sont générées par IA. Vous pouvez les remplacer par vos propres photos en gardant les mêmes noms ; il faut alors refaire la carte de profondeur (par exemple avec MiDaS).

## Modifier le contenu

Tout le contenu est décrit dans l'objet `FS` du script, en bas de `index.html` :

- `D_PROD` : les lignes du tableau synoptique ; `D_DOCS` : les fichiers du dossier E6, dont les fiches descriptives (fonction `dFiche`).
- `uData()` : les panneaux de l’univers 3D, dans l’ordre du voyage.
- `siteHTML()` : le contenu de la vue classique.
- `FS.desktop.children` : le contenu du dossier Bureau dans le Finder (le bureau lui-même reste vide).
- Chaque dossier (`stages`, `ateliers`, `perso`, `trash`) a une liste `children`.
- Chaque fichier a un `name`, un `desc` (une phrase), un `status`
  (`live`, `done`, `stop`, `pause`, `soon`), un `cat` (le texte affiché par la commande
  `cat` dans le Terminal) et une fonction `render()` qui renvoie le contenu de sa fenêtre.

Pour ajouter un projet, copiez une entrée existante (par exemple `coworking`), changez
son identifiant et son contenu, puis ajoutez cet identifiant dans le `children` du dossier voulu.

## À compléter

- Les rubriques « À préciser » des fiches : logiciels utilisés, travail en autonomie ou accompagné, individuel ou collectif, résultats obtenus, numéro de candidat.
- Les visuels des productions (cadres « Visuel à intégrer » du tableau synoptique).

- `stage2` : stage de 2e année.
- `heinz` : projet d'atelier Heinz × Absolut.
- `mariage` : projet d’atelier autour d’un mariage franco-japonais.
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
