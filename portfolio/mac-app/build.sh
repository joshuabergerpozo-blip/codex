#!/bin/bash
# Fabrique « Portfolio Joshua Berger.app » et son archive .zip dans portfolio/dist/.
# À relancer après chaque modification du portfolio : l'app contient une copie du site.
set -euo pipefail
cd "$(dirname "$0")/.."
APP="dist/Portfolio Joshua Berger.app"
rm -rf "$APP" "dist/Portfolio-Joshua-Berger-Mac.zip"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/portfolio/assets"
cp mac-app/Info.plist "$APP/Contents/Info.plist"
cp mac-app/launcher.sh "$APP/Contents/MacOS/launcher"
chmod 755 "$APP/Contents/MacOS/launcher"
cp mac-app/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
cp index.html "$APP/Contents/Resources/portfolio/index.html"
cp assets/*.webp "$APP/Contents/Resources/portfolio/assets/"
printf 'APPL????' > "$APP/Contents/PkgInfo"
(cd dist && zip -qry -X "Portfolio-Joshua-Berger-Mac.zip" "Portfolio Joshua Berger.app")
echo "OK : dist/Portfolio-Joshua-Berger-Mac.zip"
