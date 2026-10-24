"""
ZORVEX Platform: Unified Single-Terminal Process Supervisor
===========================================================
Runs Redis, FastAPI Backend, and Vite Frontend inside a SINGLE terminal window.
Zero annoying popup windows!
Clean graceful shutdown of all services on Ctrl+C.
"""

import os
import sys
import time
import signal
import webbrowser
import subprocess

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
REDIS_DIR = os.path.join(PROJECT_ROOT, "backend", "bin", "redis")
REDIS_EXE = os.path.join(REDIS_DIR, "redis-server.exe")
REDIS_CONF = "redis.windows.conf"

BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

CREATE_NO_WINDOW = 0x08000000

processes = []

def cleanup(sig=None, frame=None):
    print("\n\n" + "=" * 60)
    print(" Stopping ZORVEX Platform Services cleanly...")
    print("=" * 60)
    for name, p in processes:
        if p and p.poll() is None:
            print(f"  • Stopping {name} (PID: {p.pid})...", end="", flush=True)
            try:
                # Terminate tree
                subprocess.call(f"taskkill /F /T /PID {p.pid} >nul 2>&1", shell=True)
                print(" Stopped.")
            except Exception:
                try:
                    p.kill()
                    print(" Killed.")
                except Exception:
                    pass
    print("\n[OK] All services shut down successfully. Goodbye!\n")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def main():
    print("=" * 65)
    print("         ZORVEX - \"See Beyond Spend.\"")
    print("     Enterprise Cloud FinOps & Cost Intelligence")
    print("=" * 65)

    # 1. Start Redis
    print("\n[1/3] Starting Redis Cache Server (Port 6379)...")
    if os.path.exists(REDIS_EXE):
        redis_proc = subprocess.Popen(
            [REDIS_EXE, REDIS_CONF],
            cwd=REDIS_DIR,
            creationflags=CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        processes.append(("Redis Server", redis_proc))
        print("      ✓ Redis started quietly in background.")
    else:
        print("      ⚠️ Redis binary not found, continuing with in-memory cache.")

    # 2. Start FastAPI Backend
    print("[2/3] Starting FastAPI Backend on PostgreSQL 18 (Port 8050)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8050", "--reload"],
        cwd=BACKEND_DIR,
        creationflags=CREATE_NO_WINDOW,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    processes.append(("FastAPI Backend", backend_proc))
    print("      ✓ Backend started quietly on http://127.0.0.1:8050")

    # 3. Start Frontend Vite
    print("[3/3] Starting React Vite Frontend (Port 5173)...")
    frontend_proc = subprocess.Popen(
        "npm run dev",
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=CREATE_NO_WINDOW,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    processes.append(("Vite Frontend", frontend_proc))
    print("      ✓ Vite Frontend started on http://127.0.0.1:5173")

    time.sleep(2)
    print("\n" + "=" * 65)
    print(" 🚀 ZORVEX PLATFORM IS LIVE ON POSTGRESQL 18 (Single Window)!")
    print("=" * 65)
    print("  • Frontend Web App : http://127.0.0.1:5173")
    print("  • FastAPI REST API : http://127.0.0.1:8050")
    print("  • Database Engine  : PostgreSQL 18.6 (finops_db)")
    print("  • Dedicated User   : zorvex_app")
    print("  • Swagger API Docs : http://127.0.0.1:8050/docs")
    print("=" * 65)
    print("  [TIP] Press Ctrl+C at any time in this window to stop all services.")
    print("=" * 65 + "\n")

    # Open browser
    try:
        webbrowser.open("http://127.0.0.1:5173")
    except Exception:
        pass

    # Keep alive
    try:
        while True:
            time.sleep(1)
            # Check if critical processes died
            for name, p in processes:
                if p.poll() is not None:
                    print(f"⚠️ Notice: {name} exited unexpectedly (code {p.returncode}).")
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
