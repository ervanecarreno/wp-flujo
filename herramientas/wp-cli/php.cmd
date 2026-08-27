@echo off
rem  El PHP que trae Local WP, con el php.ini de esta carpeta. Uso: php.cmd -v
setlocal
set "LOCAL_PHP=C:\Program Files (x86)\Local\resources\extraResources\lightning-services\php-8.2.29+0\bin\win64\php.exe"
if not exist "%LOCAL_PHP%" goto :sinphp
"%LOCAL_PHP%" -c "%~dp0php.ini" %*
exit /b %ERRORLEVEL%

:sinphp
echo ERROR: no encuentro el PHP de Local. Ruta esperada:
echo    %LOCAL_PHP%
exit /b 1
