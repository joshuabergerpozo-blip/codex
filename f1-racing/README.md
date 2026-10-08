# 🏎️ F1 Garage Racing

Jeu de course de Formule 1 **multijoueur en ligne** (jusqu'à **4 pilotes** par groupe), en 3D dans le navigateur.

Tout le monde commence dans sa propre écurie avec une **caisse à savon en bois** (moteur de tondeuse, roues de
charrette, barre de bateau en guise de volant…). Chaque tour de circuit rapporte de l'argent, qui sert à
améliorer la voiture pièce par pièce jusqu'à la vraie Formule 1 en carbone.

## Lancer le jeu

Il faut [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
cd f1-racing
npm install
npm start
```

Ouvre ensuite <http://localhost:3000> dans ton navigateur (Chrome, Edge ou Firefox récents).

## Jouer avec tes amis

1. Clique sur **« Créer un groupe »** : un **code à 5 caractères** s'affiche en haut à droite (bouton « copier »).
2. Tes amis ouvrent le jeu, entrent ce code puis cliquent sur **« Rejoindre »** (4 pilotes maximum).
3. Vous roulez tous en même temps sur le circuit (essais libres). L'hôte (★) peut lancer une **course**
   de 1, 3, 5 ou 10 tours : tout le monde est placé sur la grille, les 5 feux rouges s'allument puis s'éteignent… GO !

Pour que tes amis puissent se connecter, le serveur doit être accessible depuis chez eux :

- **Même Wi-Fi / même maison** : ils ouvrent `http://<adresse-IP-de-ton-PC>:3000`.
- **Par Internet** : héberge le dossier `f1-racing` sur un service Node.js (Render, Railway, Fly.io…) avec
  `npm install` comme commande de build et `npm start` comme commande de démarrage (le port est lu dans la
  variable `PORT`). Pour un test rapide, un tunnel (ngrok, localtunnel…) vers le port 3000 fonctionne aussi.

Les écuries (argent, pièces, peinture, personnage) sont sauvegardées par le serveur dans `data/profiles.json`
et retrouvées automatiquement par chaque navigateur. Sur un hébergeur gratuit sans disque persistant, ce
fichier est remis à zéro à chaque redéploiement.

## Commandes

| Touche        | Action                                                               |
| ------------- | -------------------------------------------------------------------- |
| **Z** / **S** | Accélérer / freiner puis reculer                                     |
| **Q** / **D** | Tourner à gauche / à droite                                          |
| **Espace**    | Frein à main (dérapage)                                              |
| **Maj**       | Nitro (si achetée)                                                   |
| **E**         | Ouvrir le DRS (avec l’aileron arrière F1)                            |
| **C**         | Changer de caméra (poursuite, poursuite lointaine, caméra embarquée) |
| **G**         | Garage (hors course)                                                 |
| **R**         | Replacer la voiture sur la piste                                     |
| **Tab**       | Classement du groupe                                                 |
| **Entrée**    | Chat                                                                 |
| **M**         | Couper / remettre le son                                             |
| **Échap**     | Menu (qualité graphique, quitter le groupe)                          |

Les flèches et WASD fonctionnent aussi.

## Argent

- **400 €** par tour bouclé, ×1,2 si le tour est **propre** (sans sortie de piste ni choc).
- **+200 €** à chaque record personnel.
- En course : gains par tour **×1,5** et primes d'arrivée pour le podium.
- Les **sponsors** multiplient tous les gains (jusqu'à ×3).

## Le garage

**17 catégories de pièces** à acheter niveau par niveau (plus de 90 améliorations) :
châssis, moteur, boîte de vitesses, pneus, jantes, freins, suspension, aileron avant, aileron arrière (+ DRS),
renforcement, allègement, nitro, système hybride ERS, échappement, volant, sponsors, équipe des stands.
Chaque pièce change les performances **et** l'apparence de la voiture : la caisse en bois devient tôle rivetée,
puis aluminium, fibre de verre, carbone et enfin monocoque F1 avec halo, aileron de requin et slicks.

Il faut compter plusieurs dizaines d'heures de jeu pour tout débloquer.

Cosmétiques : 19 peintures (dont métallisées, carbone, chrome, or), couleur secondaire, 7 livrées,
numéro de course, et un **personnage en blocs façon Roblox** (couleurs de peau, haut, pantalon,
visages, 9 couvre-chefs dont casque F1 et couronne).

Les chocs abîment la voiture (elle perd de la vitesse et fume) : on la répare au garage.

## Le circuit

Circuit fermé de 2,25 km : ligne droite des stands avec grille de départ, portique des feux de départ,
stands et tour de contrôle, tribunes remplies de spectateurs, vibreurs rouge et blanc, bacs à graviers,
murs de pneus, grillages, panneaux publicitaires, panneaux de freinage 300/200/100, passerelle au-dessus de la
piste, postes de commissaires, forêts et montagnes à l'horizon. Tout est généré en 3D (Three.js) sans
téléchargement d'image.

## Organisation du code

| Fichier                                       | Rôle                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `server.js`                                   | Serveur HTTP + WebSocket : groupes, courses, gains, achats, sauvegarde          |
| `shared/catalog.js`                           | Catalogue des pièces, cosmétiques et calcul des performances (client + serveur) |
| `public/js/main.js`                           | Boucle de jeu, caméra, réseau, tours et course                                  |
| `public/js/physics.js`                        | Physique de la voiture                                                          |
| `public/js/track.js` / `trackdata.js`         | Tracé et décor du circuit                                                       |
| `public/js/car.js`                            | Modèle 3D de la voiture selon les pièces                                        |
| `public/js/avatar.js`                         | Personnages façon Roblox                                                        |
| `public/js/garage.js`                         | Garage (boutique + aperçu 3D)                                                   |
| `public/js/hud.js`, `audio.js`, `textures.js` | Interface, sons et textures procédurales                                        |
