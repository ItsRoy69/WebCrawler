@echo off
REM Quick build script for the frontend (Windows)
REM Usage: build_frontend.bat

setlocal enabledelayedexpansion

echo Building WebCrawler frontend...
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo Building...
call npm run build

echo ✅ Frontend built successfully!
echo Output: webcrawler/static/dist/
echo.
echo Run 'webcrawler serve' to start the backend and open http://localhost:8000

endlocal
