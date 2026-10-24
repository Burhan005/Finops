@echo off
title ZORVEX - Cloud Cost Intelligence Platform
cd /d "%~dp0"
python run.py
if errorlevel 1 (
    echo.
    echo An error occurred while launching ZORVEX.
    pause
)
