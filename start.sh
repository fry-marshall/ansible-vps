#!/bin/bash
# ansible-vps — Lance le GUI (backend + frontend)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Ansible VPS — démarrage..."
echo ""

# Install deps si besoin
if [ ! -d "$ROOT/gui/node_modules" ]; then
  echo "📦 Installation des dépendances frontend..."
  cd "$ROOT/gui" && npm install --legacy-peer-deps
fi
if [ ! -d "$ROOT/gui/backend/node_modules" ]; then
  echo "📦 Installation des dépendances backend..."
  cd "$ROOT/gui/backend" && npm install
fi

# Backend
cd "$ROOT/gui/backend"
node src/server.js &
BACKEND_PID=$!
echo "✅ Backend  → http://localhost:3001 (PID: $BACKEND_PID)"

sleep 1

# Frontend
cd "$ROOT/gui"
npx ng serve --port 4200 &
FRONTEND_PID=$!
echo "✅ Frontend → http://localhost:4200 (PID: $FRONTEND_PID)"

echo ""
echo "  Ouvre http://localhost:4200 dans ton navigateur"
echo "  Ctrl+C pour tout arrêter"
echo ""

trap "echo ''; echo 'Arrêt...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
