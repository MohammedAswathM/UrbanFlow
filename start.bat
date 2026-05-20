@echo off
REM UrbanFlow one-shot launcher (Windows / cmd.exe wrapper around start.ps1)
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start.ps1"
