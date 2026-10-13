@echo off
rem Praxura Praxis-Box - Einrichtung starten (Doppelklick).
rem Laedt das Einrichtungsskript von https://praxura.de/install.ps1 und startet es;
rem Windows fragt danach nach Administratorrechten. Konsey 2026-10-13, Stufe 1.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://praxura.de/install.ps1)))"
