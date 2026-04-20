#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 AcentePro başlatılıyor..."

# Backend
cd backend
node server.js &
BACKEND_PID=$!
cd ..

# Frontend
sleep 1
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ AcentePro çalışıyor!"
echo "   Tarayıcınızda açın: http://localhost:3000"
echo ""
echo "Durdurmak için bu pencereyi kapatın."

# Open browser
sleep 3
open http://localhost:3000

# Wait
wait
