# La France en relief

Une carte 3D de la France métropolitaine, à explorer dans le navigateur.

- **Imagerie :** la mosaïque Sentinel-2 sans nuages de 2021 (ESA WorldCover), à environ 140 m par pixel en 8K.
- **Relief :** le modèle numérique de terrain Copernicus GLO-90, au mètre près.

La France est découpée comme un socle. Les côtes et les frontières montrent des couches de roche.

## Utilisation

- Glisser pour tourner, clic droit (ou deux doigts) pour déplacer, molette ou pincement pour zoomer.
- Les boutons du bas font voler la caméra vers la France entière, les Alpes, les Pyrénées, le Massif central, la Corse, la Bretagne ou Paris. Chaque vue règle aussi l'exagération du relief.
- **Exagération du relief :** de ×1 (échelle réelle) à ×25.
- **Heure du jour :** déplace le soleil du lever au coucher. Les ombres portées et la couleur du ciel suivent.
- L'altitude du point sous le curseur s'affiche en haut à gauche.

Sur un ordinateur dont la carte graphique le permet, l'imagerie 8K remplace la 4K une fois chargée.

## Ouvrir la carte

La carte utilise des modules JavaScript et des textures WebGL : il faut la servir depuis un serveur web. Un double-clic sur `index.html` ne suffit pas.

```bash
cd carte-france
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Le dossier peut aussi être publié tel quel sur GitHub Pages, Netlify ou Vercel.

## Contenu

- `index.html`, `main.js` : la page et le moteur 3D (Three.js 0.170, copié dans `lib/`).
- `data/couleur-4k.webp`, `data/couleur-8k.webp` : l'imagerie en Lambert-93.
- `data/relief.webp` : l'altitude en mètres, codée sur 16 bits dans les canaux rouge (poids fort) et vert (poids faible). WebP sans perte.
- `data/masque.png` : la forme de la France, utilisée pour découper le terrain.
- `data/contours.json` : les contours simplifiés à 250 m, qui servent à construire les falaises du socle.
- `data/lieux.json` : la grille de la carte, plus les villes et les sommets affichés.

## Refaire les données

Les scripts de `outils/` régénèrent tout `data/`. Il faut Python 3 avec `rasterio`, `numpy`, `scipy`, `shapely` et `pillow`, et environ 2 Go de disque.

```bash
mkdir -p travail/geo
curl -o travail/geo/metropole.geojson https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/metropole.geojson
export GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
python3 outils/1_telecharger.py travail
python3 outils/2_assembler.py travail
python3 outils/3_textures.py travail data
python3 outils/4_lieux.py travail data
```

Pour ajouter un lieu, complétez la liste `P` de `outils/4_lieux.py`, puis relancez ce seul script.

## Sources et licences

- Contient des données Copernicus Sentinel-2 modifiées (2021), traitées par ESA WorldCover (CC BY 4.0).
- Copernicus DEM GLO-90 © DLR e.V. 2010-2014 et © Airbus Defence and Space GmbH 2014-2018, fourni dans le cadre du programme Copernicus.
- Contours : [france-geojson](https://github.com/gregoiredavid/france-geojson) (Grégoire David).
- Three.js : licence MIT (`lib/LICENSE-three.txt`).
