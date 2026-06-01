@echo off
cd /d E:\Liefercheck\PRKT1_Cursor\liefercheck
echo Initialisiere Git...
git init
git add .
git commit -m "Initial commit: LieferCheck Pro"
git branch -M main
git remote add origin https://github.com/roesslebsn-cloud/liefercheck-pro.git
echo Pushe zu GitHub...
git push -u origin main
echo.
echo Fertig! Jetzt Vercel aufrufen und Repo importieren.
pause
