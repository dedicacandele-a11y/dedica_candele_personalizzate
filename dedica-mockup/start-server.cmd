@echo off
setlocal

cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=5173"

set "PAGE=%~2"
if "%PAGE%"=="" set "PAGE=index.html"
if /I "%PAGE%"=="admin" set "PAGE=admin"
if /I "%PAGE%"=="shop" set "PAGE=index.html#prodotti"
if /I "%PAGE%"=="cart" set "PAGE=cart.html"
if /I "%PAGE%"=="config" set "PAGE=configuratore.html"

echo.
echo DEDICA - server locale
echo ----------------------
echo Home:          http://localhost:%PORT%/
echo Shop:          http://localhost:%PORT%/index.html#prodotti
echo Configuratore: http://localhost:%PORT%/configuratore.html
echo Carrello:      http://localhost:%PORT%/cart.html
echo Admin:         http://localhost:%PORT%/admin
echo.
echo Accesso admin: gennaro.mazzacane@gmail.com
echo.
echo Apertura: http://localhost:%PORT%/%PAGE%
echo.
start "" "http://localhost:%PORT%/%PAGE%"

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 -m http.server %PORT%
  exit /b %ERRORLEVEL%
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python -m http.server %PORT%
  exit /b %ERRORLEVEL%
)

where python3 >nul 2>nul
if %ERRORLEVEL%==0 (
  python3 -m http.server %PORT%
  exit /b %ERRORLEVEL%
)

echo Python non trovato. Installa Python oppure avvia manualmente un server statico.
exit /b 1
