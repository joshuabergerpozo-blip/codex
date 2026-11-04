"""Télécharge la mosaïque Sentinel-2 2021 (ESA WorldCover, aperçu à 80 m) et le relief Copernicus GLO-90
pour chaque dalle de 1° qui touche la France. Variables utiles : GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR."""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np, rasterio
from rasterio.transform import from_bounds
from shapely.geometry import shape, box
# Usage : python3 1_telecharger.py <dossier de travail>
# Le dossier doit contenir geo/metropole.geojson (github.com/gregoiredavid/france-geojson).
S = sys.argv[1]
RAW = f'{S}/raw'
os.makedirs(RAW, exist_ok=True)
g = json.load(open(f'{S}/geo/metropole.geojson'))
fr = shape((g['features'][0] if 'features' in g else g)['geometry']).buffer(0.08)
tiles = [(la, lo) for la in range(41, 52) for lo in range(-6, 10) if fr.intersects(box(lo, la, lo + 1, la + 1))]
print(len(tiles), 'tiles')
def ns(la): return ('N' if la >= 0 else 'S') + f'{abs(la):02d}'
def ew(lo, w=3): return ('E' if lo >= 0 else 'W') + f'{abs(lo):0{w}d}'
def rgb(t):
    la, lo = t
    out = f'{RAW}/rgb_{la}_{lo}.tif'
    if os.path.exists(out): return 'skip'
    u = f'/vsicurl/https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/{ns(la)}/ESA_WorldCover_10m_2021_v200_{ns(la)}{ew(lo)}_S2RGBNIR.tif'
    try:
        with rasterio.open(u) as d:
            a = d.read([1, 2, 3], out_shape=(3, 1500, 1500))
            prof = dict(driver='GTiff', width=1500, height=1500, count=3, dtype='uint16', crs=d.crs, nodata=0,
                        transform=from_bounds(*d.bounds, 1500, 1500), compress='deflate')
        with rasterio.open(out, 'w', **prof) as o: o.write(a)
        return 'ok'
    except Exception as e: return f'ERR {e}'
def dem(t):
    la, lo = t
    out = f'{RAW}/dem_{la}_{lo}.tif'
    if os.path.exists(out): return 'skip'
    n = f'Copernicus_DSM_COG_30_{ns(la)}_00_{ew(lo)}_00_DEM'
    u = f'/vsicurl/https://copernicus-dem-90m.s3.amazonaws.com/{n}/{n}.tif'
    try:
        with rasterio.open(u) as d:
            a = d.read(1)
            prof = dict(driver='GTiff', width=d.width, height=d.height, count=1, dtype='float32', crs=d.crs, transform=d.transform, compress='deflate')
        with rasterio.open(out, 'w', **prof) as o: o.write(a, 1)
        return 'ok'
    except Exception as e: return f'ERR {e}'
with ThreadPoolExecutor(10) as ex:
    r1 = list(ex.map(rgb, tiles)); r2 = list(ex.map(dem, tiles))
for t, a, b in zip(tiles, r1, r2):
    if a.startswith('ERR') or b.startswith('ERR'): print(t, a[:90], '|', b[:90])
print('rgb ok', sum(x != 'skip' and not x.startswith('ERR') for x in r1), 'dem ok', sum(x != 'skip' and not x.startswith('ERR') for x in r2))
