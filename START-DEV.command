#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installe-le d'abord avec : brew install node"
  read -n 1 -s -r -p "Appuie sur une touche pour fermer."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installation des dépendances…"
  npm install
fi
if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi
echo "ANSEM WORLD va s'ouvrir sur http://localhost:3000"
(sleep 3; open "http://localhost:3000") &
npm run dev
