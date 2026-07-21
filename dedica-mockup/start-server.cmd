@echo off
setlocal

cd /d "%~dp0"

echo.
echo DEDICA - app React locale
echo -------------------------
echo Home:          http://localhost:5173/
echo Admin:         http://localhost:5173/admin
echo Account:       http://localhost:5173/account
echo Carrello:      http://localhost:5173/cart
echo Configuratore: http://localhost:5173/configuratore
echo.
echo Accesso admin: gennaro.mazzacane@gmail.com
echo.

npm run dev
