@echo off
title ZORVEX - Cloud Cost Intelligence Platform
cls
echo ========================================================
echo         ZORVEX - "See Beyond Spend."
echo     Enterprise Cloud FinOps & Cost Intelligence
echo ========================================================
echo.
echo [1/2] Starting Python FastAPI Backend with Nodemon on http://localhost:8050 ...
start "ZORVEX Backend (Nodemon Port 8050)" cmd /k "cd /d %~dp0backend && npx nodemon"

echo [2/2] Starting React Vite Frontend on http://localhost:5173 ...
start "ZORVEX Frontend (Vite Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 >nul
echo Launching ZORVEX in default browser...
start http://localhost:5173

echo.
echo ========================================================
echo  ZORVEX Platform is LIVE:
echo  - Frontend Web App:  http://localhost:5173
echo  - Backend API:       http://localhost:8050
echo  - Swagger API Docs:  http://localhost:8050/docs
echo ========================================================
echo.
pause
