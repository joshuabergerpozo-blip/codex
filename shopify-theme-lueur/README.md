# Lueur — thème Shopify pour réveil simulateur d'aube

Thème Shopify Online Store 2.0 (sections partout, JSON templates) pensé pour une
boutique mono-produit qui vend un **réveil simulateur d'aube**.

- **Ambiance apaisante** : palette solaire (rouge de l'aube → orange → abricot → crème), fonds pêche, sections « nuit » pour le contraste.
- **Typographies grasses et rondes** : *Fredoka* (titres) et *Nunito* (texte), hébergées dans `assets/` (aucun appel externe).
- **Vidéo motion design** de 24 s (`assets/lueur-motion.mp4`, 1,2 Mo) : la nuit, le « BIP BIP » agressif, puis un lever de soleil qui remplit l'écran, les trois bénéfices, et la signature de marque. Elle boucle sans coupure.
- **Visuels** : 6 photos produit et lifestyle générées pour le thème (`assets/lueur-*.jpg`).
- **Copywriting** de conversion en français, entièrement modifiable depuis l'éditeur.

## Installation

1. Compressez le contenu du dossier (sans `tools/` ni ce README) :
   ```bash
   cd shopify-theme-lueur
   zip -r ../lueur-theme.zip assets config layout locales sections snippets templates
   ```
2. Dans Shopify : **Boutique en ligne → Thèmes → Ajouter un thème → Importer un fichier ZIP**.
   Ou avec le CLI : `shopify theme push --unpublished --path shopify-theme-lueur`.
3. Dans l'éditeur de thème :
   - section **Produit mis en avant** (accueil) : choisissez votre produit ;
   - **En-tête / Pied de page** : sélectionnez vos menus ;
   - ajoutez vos propres photos (les images fournies servent de démonstration tant qu'aucune image n'est choisie).

## Page d'accueil — structure de vente

| # | Section | Rôle |
|---|---------|------|
| 1 | Héros | Promesse : « Et si demain, c'était le soleil qui vous réveillait ? » + CTA + accès au film |
| 2 | Bandeau défilant | Bénéfices clés en un coup d'œil |
| 3 | Problème | Le sursaut, le snooze sans fin, l'hiver dans le noir |
| 4 | Vidéo motion design | Le produit expliqué en 24 s + chiffres clés |
| 5 | Étapes de l'aube | −30 / −15 / 0 min : le mécanisme, simplement |
| 6 | Image et texte | Fonctionnalités, formulées en bénéfices |
| 7 | Image et texte (nuit) | Le mode crépuscule : un 2e usage, le soir |
| 8 | Comparatif | Lueur vs réveil classique vs smartphone |
| 9 | Témoignages | Preuve sociale |
| 10 | Produit mis en avant | Achat direct depuis l'accueil |
| 11 | Garantie | Inversion du risque : 100 nuits d'essai |
| 12 | FAQ | Lève les objections (+ données structurées FAQPage) |
| 13 | Newsletter | Aimant à prospects : « le guide des matins doux » |

Autres gabarits inclus : produit (avec barre d'achat collante sur mobile), collection, panier (barre de livraison offerte),
recherche, blog, article, page, contact (`page.contact`), 404, mot de passe, carte cadeau et tous les gabarits compte client.

## À adapter avant la mise en ligne

Le texte est prêt à vendre, mais certaines affirmations doivent correspondre à **votre** produit et à **votre** politique :

- caractéristiques techniques (durée d'aube 10–60 min, 20 niveaux, 7 sons, radio FM, 2 alarmes, USB-C) ;
- promesses commerciales (livraison offerte en 48 h, 100 nuits d'essai, garantie 2 ans, SAV en France, prix barré) ;
- **avis clients** : les trois témoignages sont des exemples, marqués « Exemple d'avis · à remplacer ». Remplacez-les par de vrais avis, et n'affichez une note (« 4,8/5 ») que si elle provient de vos avis réels — la loi française sanctionne les faux avis.

## Personnalisation

- **Couleurs** : *Paramètres du thème → Couleurs* (9 teintes).
- **Mots surlignés** dans les titres : mettez-les en *italique* dans l'éditeur, ils s'affichent en orange avec un surlignage doux.
- **Vidéo** : la section « Vidéo motion design » accepte votre propre vidéo hébergée sur Shopify ; sinon le film fourni est utilisé.

## Régénérer la vidéo

Le film est une animation Canvas déterministe (`tools/motion/lueur-motion.html`, ouvrable seule dans un navigateur).
Pour ré-encoder le MP4 après modification :

```bash
pip install imageio-ffmpeg                 # ou ffmpeg dans le PATH
npm i -g playwright
NODE_PATH=$(npm root -g) node tools/motion/render.cjs
```

## Qualité

- `shopify theme check` : aucune erreur, aucun avertissement.
- Accessibilité : lien d'évitement, focus visibles, libellés ARIA, vidéo avec bouton pause, respect de `prefers-reduced-motion`.
- Performance : aucune librairie JS, polices locales préchargées, images en `srcset`, vidéo lue uniquement quand elle est visible.
