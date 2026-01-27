@echo off
echo Starting Backend (Port 8000)...
start cmd /k "python run_server.py"

echo Starting Frontend (Dev Server)...
cd frontend
npm run dev
