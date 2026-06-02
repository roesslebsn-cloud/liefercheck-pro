@echo off
cd /d E:\Liefercheck\PRKT1_Cursor\liefercheck
if exist .git\index.lock del /f .git\index.lock
git add -A
git commit -m "fix: logout sofort, pfandliste umbenennen, filter-styling"
git push origin main
echo.
echo Fertig!
pause
