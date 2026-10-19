@echo off
title ZORVEX - Cloud Cost Intelligence Platform
cls
echo ========================================================
echo         ZORVEX - "See Beyond Spend."
echo     Enterprise Cloud FinOps & Cost Intelligence
echo ========================================================
echo.
echo [1/3] Starting Redis Cache Server on 127.0.0.1:6379 ...
start "ZORVEX Redis Cache (Port 6379)" cmd /k "cd /d %~dp0backend\bin\redis && redis-server.exe redis.windows.conf"

echo [2/3] Starting Python FastAPI Backend on http://localhost:8050 ...
start "ZORVEX Backend (Port 8050)" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8050 --reload"

echo [3/3] Starting React Vite Frontend on http://localhost:5173 ...
start "ZORVEX Frontend (Vite Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 >nul
echo Launching ZORVEX in default browser...
start http://localhost:5173

echo.
echo ========================================================
echo  ZORVEX Platform is LIVE:
echo  - Frontend Web App:  http://localhost:5173
echo  - Backend API:       http://localhost:8050
echo  - Redis Cache:       127.0.0.1:6379
echo  - Swagger API Docs:  http://localhost:8050/docs
echo ========================================================
echo.
pause
