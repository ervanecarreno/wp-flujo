@echo off
rem  wp-cli usando el PHP que trae Local WP, desde cualquier terminal.
rem  No hace falta abrir el "site shell" de la interfaz de Local.
rem
rem  Uso:
rem    herramientas\wp-cli\wp.cmd <comando> --path="C:\Users\David\Local Sites\<sitio>\app\public"
rem  Ejemplo:
rem    herramientas\wp-cli\wp.cmd core version --path="C:\Users\David\Local Sites\figma-staging\app\public"
rem
rem  Ojo: los comandos que leen o escriben en la base de datos necesitan que el sitio
rem  este ARRANCADO en Local (boton Start site). Los que solo leen ficheros, no.
setlocal
set "LOCAL_PHP=C:\Program Files (x86)\Local\resources\extraResources\lightning-services\php-8.2.29+0\bin\win64\php.exe"
set "WP_PHAR=C:\Program Files (x86)\Local\resources\extraResources\bin\wp-cli\wp-cli.phar"
set "PHP_INI=%~dp0php.ini"
if not exist "%LOCAL_PHP%" goto :sinphp
if not exist "%WP_PHAR%" goto :sinwp
"%LOCAL_PHP%" -c "%PHP_INI%" "%WP_PHAR%" %*
exit /b %ERRORLEVEL%

:sinphp
echo ERROR: no encuentro el PHP de Local. Ruta esperada:
echo    %LOCAL_PHP%
echo Si has actualizado Local, habra cambiado la version de PHP.
echo Corrige la ruta en este fichero y en php.ini (misma carpeta).
exit /b 1

:sinwp
echo ERROR: no encuentro wp-cli.phar. Ruta esperada:
echo    %WP_PHAR%
exit /b 1
