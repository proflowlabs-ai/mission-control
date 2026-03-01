#!/bin/bash

cd /home/openclaw/.openclaw/workspace/mission-control

echo "🚀 Starting Mission Control..."

# Kill any existing processes
pkill -f "next dev" 2>/dev/null
pkill -f "tsx src/server" 2>/dev/null
sleep 1

# Start Backend
echo "📡 Starting Backend on port 4000..."
nohup npx tsx src/server.ts > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > .pid.backend
echo "Backend PID: $BACKEND_PID"

sleep 2

# Start Frontend
echo "🎨 Starting Frontend on port 3000..."
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > .pid.frontend
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Mission Control is running!"
echo ""
echo "📍 Access:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo ""
echo "📋 Logs:"
echo "   tail -f backend.log"
echo "   tail -f frontend.log"
