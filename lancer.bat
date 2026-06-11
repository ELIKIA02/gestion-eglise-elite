@echo off
title Gestion d'Église Élite
cd /d "%~dp0"

echo ============================================
echo     Gestion d'Église Élite - Démarrage
echo ============================================
echo.

if not exist "node_modules" (
    echo Installation des dependances...
    call npm install
    if errorlevel 1 (
        echo Erreur lors de l'installation des dependances.
        pause
        exit /b 1
    )
    echo.
)

if not exist ".env.local" (
    if exist ".env.example" (
        copy ".env.example" ".env.local" >nul
        echo [ATTENTION] Fichier .env.local cree depuis .env.example.
        echo            Modifiez MISTRAL_API_KEY dans .env.local avant d'utiliser l'IA.
        echo.
    )
)

echo Lancement du serveur sur http://localhost:3000
echo Appuyez sur Ctrl+C dans la fenetre pour arreter.
echo.
npm run dev

pause
