#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Errore: Node.js è richiesto per controllare la sintassi JavaScript." >&2
  exit 1
fi

for file in js/*.js api/*.js lib/*.cjs; do
  node --check "$file"
done

if [[ -f assets/dashboard/dashboard.js ]]; then
  node --check assets/dashboard/dashboard.js
fi

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re

html = Path("index.html").read_text(encoding="utf-8")
missing = []
for path in re.findall(r'(?:src|href)="((?:(?:js|css|assets/dashboard)/)[^"?#]+)"', html):
    if not Path(path).is_file():
        missing.append(path)
if missing:
    raise SystemExit("Riferimenti locali mancanti: " + ", ".join(missing))

source_maps = [
    path
    for directory in ("assets", "css", "fp", "js", "pd")
    for path in Path(directory).rglob("*.map")
]
if source_maps:
    raise SystemExit("Source map pubbliche vietate: " + ", ".join(map(str, source_maps)))

for required in (
    "dashboard/package.json",
    "dashboard/src/main.tsx",
    "dashboard/src/App.tsx",
    "assets/dashboard/dashboard.js",
    "assets/dashboard/dashboard.css",
):
    if not Path(required).is_file():
        raise SystemExit("Dashboard React incompleta: " + required)

json.loads(Path("vercel.json").read_text(encoding="utf-8"))
for required in ("fp/admin-links/index.html", "pd/admin-links/index.html", "css/admin-links.css", "js/admin-links.js", "js/club-keys.js", "js/player-media.js", "api/player-photo.js", "api/crest.js", "lib/neon.cjs", "lib/migrate-neon.cjs", "data/settings.json"):
    if not Path(required).is_file():
        raise SystemExit("Pannello/configurazione incompleti: " + required)
PYCHECK

node scripts/generate-route-pages.mjs --check

if grep -Eq 'league-calendar-root|/api/matchday|/api/calendar' assets/dashboard/dashboard.js; then
  echo "Errore: il bundle contiene ancora dipendenze del vecchio Calendario." >&2
  exit 1
fi


for asset in \
  assets/identity/fp-logo.png \
  assets/identity/pd-logo.png \
  fp/favicon.svg \
  fp/apple-touch-icon.png \
  pd/favicon.svg \
  pd/apple-touch-icon.png; do
  if [[ ! -f "$asset" ]]; then
    echo "Errore: asset identita mancante: $asset" >&2
    exit 1
  fi
done

if grep -q '<link rel="apple-touch-icon"' index.html; then
  echo "Errore: la home non deve dichiarare un'icona Apple di lega." >&2
  exit 1
fi

if find . -maxdepth 1 -type d -name '.lineup-backup-*' -print -quit | grep -q .; then
  echo "Errore: è presente una cartella backup della patch nella root." >&2
  exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
fi
printf '✓ Controllo statico superato.\n'
