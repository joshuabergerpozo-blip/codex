# Lueur Studio

Site de motion design : 50 templates animés, design sonore synthétisé en direct et export MP4, le tout dans le navigateur. Aucune clé API, aucun serveur de rendu.

## Mettre le site en ligne

C'est un site statique : il suffit d'héberger ce dossier tel quel.

- **Vercel** : « Add New Project », choisis le dépôt, mets `motion-studio` comme *Root Directory*, pas de commande de build.
- **Netlify** : glisse-dépose le dossier `motion-studio` sur app.netlify.com/drop.
- **GitHub Pages** : publie le dossier `motion-studio` depuis la branche de ton choix.

Pour tester en local : `npx http-server motion-studio` puis ouvre http://localhost:8080. Ouvrir `index.html` directement depuis le disque ne suffit pas, car les images doivent être servies en HTTP pour l'export.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html`, `css/style.css` | Le site : accueil, galerie, kits sonores, studio |
| `js/engine.js` | Moteur d'animation Canvas 2D : fonds, 27 types de scènes, typographie |
| `js/templates.js` | Les 50 templates, 16 palettes et 6 styles typographiques |
| `js/audio.js` | Design sonore Web Audio : 8 ambiances musicales et les bruitages calés sur l'animation |
| `js/export.js` | Export MP4 (WebCodecs + mp4-muxer), repli MediaRecorder |
| `js/app.js` | Interface : galerie, studio, export |
| `assets/img/` | Visuels de la direction artistique |

## Ajouter un template

Dans `js/templates.js`, un template est une liste de scènes posées sur une ligne de temps :

```js
T({ id: 'mon-template', name: 'Mon template', obj: 'conatif', goal: 'Faire cliquer', type: 'bold', pal: 'citron',
  bg: { type: 'mesh' }, kit: 'punch', dur: 8,
  scenes: [
    S('title', 0.2, 8, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.4, out: 'none' }),
    S('cta', 3, 8, { text: '{cta}', y: 0.65, out: 'none' }),
  ],
  f: { l1: ['Titre, ligne 1', 'Hello', 14], l2: ['Titre, ligne 2', '*toi*', 14], cta: ['Bouton', 'Go', 18] } });
```

- `obj` : `cognitif`, `affectif` ou `conatif`.
- Les `{champs}` deviennent des zones de texte dans le studio. `*mot*` passe en italique serif.
- `L: { … }` sur une scène remplace ses réglages en format paysage (16:9).
- Les bruitages se calent tout seuls sur les scènes : il n'y a rien à faire côté son.

## Compatibilité de l'export

- Chrome, Edge, Safari récents : MP4 H.264 + AAC, calculé plus vite que le temps réel.
- Navigateurs sans WebCodecs : enregistrement en temps réel (MP4 ou WebM selon le navigateur).

## Crédits

- Polices : Google Fonts (Unbounded, Bricolage Grotesque, Instrument Serif, Fraunces, Hanken Grotesk, Space Mono), licence OFL.
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer), licence MIT (`js/vendor/`).
- Visuels générés avec le modèle Z-Image Turbo.
