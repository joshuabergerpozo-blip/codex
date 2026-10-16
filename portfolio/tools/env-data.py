#!/usr/bin/env python3
"""Regroupe les environnements de assets/env/ dans assets/env/env-data.js (data URI).

En file://, WebGL refuse les images chargées depuis le disque : le portfolio lit alors ce fichier.
À relancer après avoir changé une image ou une carte de profondeur : python3 tools/env-data.py
"""
import base64
import json
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / 'assets' / 'env'
data = {}
for img in sorted(ENV.glob('*.webp')):
    depth = ENV / f'{img.stem}-depth.png'
    if not depth.exists():
        continue
    data[img.stem] = {
        'c': 'data:image/webp;base64,' + base64.b64encode(img.read_bytes()).decode(),
        'd': 'data:image/png;base64,' + base64.b64encode(depth.read_bytes()).decode(),
    }
(ENV / 'env-data.js').write_text(
    '/* Généré par tools/env-data.py : les environnements en data URI pour une ouverture en file://. */\n'
    'window.JOSH_ENV = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print(f'{len(data)} environnements → {ENV / "env-data.js"}')
