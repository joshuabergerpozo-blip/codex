"""Assemble les dalles en Lambert-93 (EPSG:2154) : couleur 8192 px de large, relief à la moitié, masque et contours."""
import json, sys, glob
import numpy as np, rasterio
from rasterio.merge import merge
from rasterio.warp import reproject, Resampling, transform_geom
from rasterio.transform import from_bounds
from rasterio.features import rasterize
from shapely.geometry import shape, mapping, Polygon
# Usage : python3 2_assembler.py <dossier de travail>
S = sys.argv[1]; RAW = f'{S}/raw'; OUT = f'{S}/work'
import os; os.makedirs(OUT, exist_ok=True)
L93 = 'EPSG:2154'
g = json.load(open(f'{S}/geo/metropole.geojson'))
geom = (g['features'][0] if 'features' in g else g)['geometry']
fr = shape(transform_geom('EPSG:4326', L93, geom))
x0, y0, x1, y1 = fr.bounds
m = 12000
x0 -= m; y0 -= m; x1 += m; y1 += m
W = 8192; px = (x1 - x0) / W; H = int(round((y1 - y0) / px)); y0 = y1 - H * px
print('grid', W, H, 'px', px, (x0, y0, x1, y1))
json.dump({'bounds': [x0, y0, x1, y1], 'W': W, 'H': H, 'px': px}, open(f'{OUT}/grid.json', 'w'))
tr = from_bounds(x0, y0, x1, y1, W, H)
def warp(files, count, dtype, res, nodata):
    srcs = [rasterio.open(f) for f in files]
    mos, mt = merge(srcs, nodata=nodata)
    dst = np.zeros((count, H // res, W // res), dtype=np.float32)
    reproject(mos.astype(np.float32), dst, src_transform=mt, src_crs=srcs[0].crs, dst_transform=from_bounds(x0, y0, x1, y1, W // res, H // res), dst_crs=L93,
              resampling=Resampling.bilinear if res > 1 or count == 1 else Resampling.cubic, src_nodata=nodata, dst_nodata=0)
    return dst
rgb = warp(sorted(glob.glob(f'{RAW}/rgb_*.tif')), 3, 'uint16', 1, 0)
np.save(f'{OUT}/rgb8k.npy', rgb.astype(np.uint16))
dem = warp(sorted(glob.glob(f'{RAW}/dem_*.tif')), 1, 'float32', 2, -32767)[0]
np.save(f'{OUT}/dem4k.npy', dem)
# Masque (suréchantillonné x2 pour l'anticrénelage)
# Contours extérieurs seulement : les étangs (Berre, Thau…) restent dans le socle
mask = rasterize([(mapping(Polygon(p.exterior)), 255) for p in getattr(fr, 'geoms', [fr])], out_shape=(H, W), transform=tr, fill=0, dtype='uint8')
np.save(f'{OUT}/mask8k.npy', mask)
print('dem range', float(dem.min()), float(dem.max()), 'rgb mean', rgb.reshape(3, -1)[:, mask.reshape(-1) > 0].mean(1))
# Contours simplifiés en coordonnées normalisées (0..1, origine en haut à gauche)
polys = list(getattr(fr, 'geoms', [fr]))
rings = []
for p in polys:
    if p.area < 4e6: continue  # îlots < 4 km²
    q = p.simplify(250)
    r = [[(x - x0) / (x1 - x0), (y1 - y) / (y1 - y0)] for x, y in q.exterior.coords]
    rings.append([[round(a, 5), round(b, 5)] for a, b in r])
json.dump(rings, open(f'{OUT}/rings.json', 'w'))
print(len(rings), 'rings', sum(len(r) for r in rings), 'points')
