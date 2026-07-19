#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "ANSEM WORLD — aperçu local"
echo "Le site va s'ouvrir sur http://localhost:8000"
(sleep 1; open "http://localhost:8000") &
python3 -m http.server 8000 --directory preview
