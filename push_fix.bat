@echo off
cd /d E:\Liefercheck\PRKT1_Cursor\liefercheck
if exist .git\index.lock del /f .git\index.lock
git add -A
git commit -m "feat: rollen-system, filter, loeschen, dashboard-redesign, detail-fix"
git push origin main
echo.
echo Fertig! Vercel deployt automatisch.
pause
