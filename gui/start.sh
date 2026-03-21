#!/bin/bash
# Lance le backend + frontend en parallèle

echo "🚀 Démarrage de Ansible VPS GUI..."
echo ""

# Backend
cd "$(dirname "$0")/backend" && node src/server.js &
BACKEND_PID=$!
echo "✅ Backend démarré (PID: $BACKEND_PID) → http://localhost:3001"

# Attendre que le backend soit prêt
sleep 1

# Frontend
cd "$(dirname "$0")" && npx ng serve --port 4200 &
FRONTEND_PID=$!
echo "✅ Frontend démarré (PID: $FRONTEND_PID) → http://localhost:4200"

echo ""
echo "📺 Interface disponible sur : http://localhost:4200"
echo "🔌 API backend sur : http://localhost:3001"
echo ""
echo "Ctrl+C pour arrêter les deux serveurs"

# Attendre et gérer Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Serveurs arrêtés.'" EXIT
wait
