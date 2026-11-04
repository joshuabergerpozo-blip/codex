"""Étalonne la couleur Sentinel-2 et écrit les textures du site dans data/."""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
# Usage : python3 3_textures.py <dossier de travail> <carte-france/data>
S = sys.argv[1]; W = f'{S}/work'; OUT = sys.argv[2]
Image.MAX_IMAGE_PIXELS = None
rgb = np.load(f'{W}/rgb8k.npy').astype(np.float32) / 10000.
mask8 = np.load(f'{W}/mask8k.npy')
H8, W8 = mask8.shape
def tone(x):
    y = np.clip(x * 3.0, 0, None)
    y = y / (1 + y * 0.35) * 1.35
    y = np.clip(y, 0, 1) ** .76
    l = y.mean(0, keepdims=True)
    y = np.clip(l + (y - l) * 1.3, 0, 1)
    y = y * y * (3 - 2 * y) * .35 + y * .65  # légère courbe en S
    return y
col = np.empty((H8, W8, 3), np.uint8)
for r0 in range(0, H8, 1024):  # par bandes pour la mémoire
    col[r0:r0 + 1024] = (np.moveaxis(tone(rgb[:, r0:r0 + 1024]), 0, -1) * 255 + .5).astype(np.uint8)
del rgb
# Remplit l'extérieur avec la couleur intérieure la plus proche (évite les liserés noirs au filtrage)
inside = mask8 > 127
small_in = inside[::4, ::4]
idx = ndimage.distance_transform_edt(~small_in, return_distances=False, return_indices=True)
small = col[::4, ::4][idx[0], idx[1]]
fill = np.asarray(Image.fromarray(small).resize((W8, H8), Image.BILINEAR))
col = np.where(inside[..., None], col, fill)
# Les bords intérieurs : petit fondu pour ne pas voir de cassure
im8 = Image.fromarray(col)
im8.save(f'{OUT}/couleur-8k.webp', quality=86, method=5)
im8.resize((4096, round(4096 * H8 / W8)), Image.LANCZOS).save(f'{OUT}/couleur-4k.webp', quality=88, method=5)
dem = np.load(f'{W}/dem4k.npy')
dem = np.clip(dem, 0, 6000)
H4, W4 = dem.shape
# Masque anticrénelé, à la taille du relief
Image.fromarray(mask8).resize((W4, H4), Image.BOX).save(f'{OUT}/masque.png', optimize=True)
# Relief au mètre près, codé sur R (poids fort) et G (poids faible), en WebP sans perte
dm = np.round(dem).astype(np.uint16)
rel = np.zeros((H4, W4, 3), np.uint8); rel[..., 0] = dm >> 8; rel[..., 1] = dm & 255
Image.fromarray(rel).save(f'{OUT}/relief.webp', lossless=True, quality=100, method=6)
print('ok', col.shape, dem.shape)
