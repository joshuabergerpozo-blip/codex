#!/bin/bash
# Lanceur de « Portfolio Joshua Berger.app ».
# Ouvre le portfolio en plein écran, sans barre d'adresse ni onglets.
# Quitter : ⌘Q.

HERE="$(cd "$(dirname "$0")/../Resources/portfolio" && pwd)"
URL="file://${HERE// /%20}/index.html"
PROFILE="$HOME/Library/Application Support/Portfolio Joshua Berger"
mkdir -p "$PROFILE"

# Mode « kiosque » : plein écran total, aucune interface de navigateur visible.
for BROWSER in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  if open -Ra "$BROWSER" >/dev/null 2>&1; then
    open -na "$BROWSER" --args \
      --kiosk --app="$URL" \
      --user-data-dir="$PROFILE" \
      --no-first-run --no-default-browser-check \
      --disable-features=Translate,InfiniteSessionRestore \
      --disable-session-crashed-bubble --hide-crash-restore-bubble \
      --overscroll-history-navigation=0
    exit 0
  fi
done

# Aucun navigateur compatible : ouverture dans Safari, puis plein écran.
osascript -e 'display dialog "Le portfolio va s’ouvrir dans Safari. Pour le plein écran, appuyez sur Contrôle + Commande + F." buttons {"OK"} default button 1 with title "Portfolio Joshua Berger"' >/dev/null 2>&1
open -a Safari "$URL"
