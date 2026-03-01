#!/bin/bash

set -e

cd /home/openclaw/.openclaw/workspace/mission-control

echo "🚀 Starting Mission Control (Production)..."

# Kill any existing processes
echo "Stopping old processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
pkill -f "tsx src/server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
sleep 2

# Build Frontend
echo "📦 Building Frontend..."
npm run build

# Start Backend
echo "📡 Starting Backend on port 4000..."
nohup npx tsx src/server.ts >> backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 3

# Start Frontend
echo "🎨 Starting Frontend on port 3000 (Production)..."
nohup npm start >> frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Mission Control is running (Production Mode)!"
echo ""
echo "📍 Access:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "⏹️  To stop: pkill -f 'npm start' && pkill -f 'tsx src/server'"
