"""Place les villes et les sommets sur la grille de la carte (data/lieux.json) et copie les contours (data/contours.json).
Usage : python3 4_lieux.py <dossier de travail> <carte-france/data>"""
import json, shutil, sys
from rasterio.warp import transform
S, OUT = sys.argv[1], sys.argv[2]
g = json.load(open(f'{S}/work/grid.json')); x0, y0, x1, y1 = g['bounds']
# nom, latitude, longitude, type, importance (villes : 1 ou 2) ou altitude (sommets)
P = [('Paris', 48.8566, 2.3522, 'ville', 1), ('Marseille', 43.2965, 5.3698, 'ville', 1), ('Lyon', 45.764, 4.8357, 'ville', 1), ('Toulouse', 43.6047, 1.4442, 'ville', 1),
     ('Nice', 43.7102, 7.262, 'ville', 1), ('Nantes', 47.2184, -1.5536, 'ville', 1), ('Strasbourg', 48.5734, 7.7521, 'ville', 1), ('Montpellier', 43.6108, 3.8767, 'ville', 2),
     ('Bordeaux', 44.8378, -0.5792, 'ville', 1), ('Lille', 50.6292, 3.0573, 'ville', 1), ('Rennes', 48.1173, -1.6778, 'ville', 2), ('Brest', 48.3904, -4.4861, 'ville', 2),
     ('Le Havre', 49.4944, 0.1079, 'ville', 2), ('Clermont-Ferrand', 45.7772, 3.087, 'ville', 2), ('Dijon', 47.322, 5.0415, 'ville', 2), ('Grenoble', 45.1885, 5.7245, 'ville', 2),
     ('Ajaccio', 41.9192, 8.7386, 'ville', 2), ('Bastia', 42.6973, 9.4509, 'ville', 2), ('Biarritz', 43.4832, -1.5586, 'ville', 2), ('Perpignan', 42.6887, 2.8948, 'ville', 2),
     ('Limoges', 45.8336, 1.2611, 'ville', 2), ('Reims', 49.2583, 4.0317, 'ville', 2), ('Caen', 49.1829, -0.3707, 'ville', 2), ('Tours', 47.3941, 0.6848, 'ville', 2),
     ('Mont Blanc', 45.8326, 6.8652, 'sommet', 4808), ('Vignemale', 42.7739, -0.1475, 'sommet', 3298), ('Puy de Sancy', 45.5283, 2.8139, 'sommet', 1885),
     ('Mont Ventoux', 44.1739, 5.2786, 'sommet', 1909), ('Monte Cinto', 42.3794, 8.9455, 'sommet', 2706), ('Grand Ballon', 47.9014, 7.0981, 'sommet', 1424),
     ('Barre des Écrins', 44.9222, 6.36, 'sommet', 4102), ('Mont Gerbier de Jonc', 44.8433, 4.2203, 'sommet', 1551), ('Crêt de la Neige', 46.2706, 5.9406, 'sommet', 1720)]
xs, ys = transform('EPSG:4326', 'EPSG:2154', [p[2] for p in P], [p[1] for p in P])
lieux = [{'n': p[0], 't': p[3], 'v': p[4], 'u': round((x - x0) / (x1 - x0), 5), 'w': round((y1 - y) / (y1 - y0), 5)} for p, x, y in zip(P, xs, ys)]
g['km'] = [(x1 - x0) / 1000, (y1 - y0) / 1000]
json.dump({'grid': g, 'lieux': lieux}, open(f'{OUT}/lieux.json', 'w'), ensure_ascii=False)
shutil.copy(f'{S}/work/rings.json', f'{OUT}/contours.json')
