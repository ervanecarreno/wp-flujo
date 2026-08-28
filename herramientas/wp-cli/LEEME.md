# wp-cli y PHP sin instalar nada

Local WP ya trae PHP y wp-cli dentro. No hace falta instalarlos en el sistema ni abrir el
"site shell" de la interfaz de Local: estos dos scripts los llaman directamente.

Verificado el 27/08/2026: **PHP 8.2.29** y **WP-CLI 2.12.0**.

## Uso

```
herramientas\wp-cli\wp.cmd <comando> --path="C:\Users\David\Local Sites\<sitio>\app\public"
herramientas\wp-cli\php.cmd -v
```

Ejemplo real que funciona:

```
herramientas\wp-cli\wp.cmd core version --path="C:\Users\David\Local Sites\figma-staging\app\public"
```

Desde PowerShell, si la ruta lleva espacios, guárdala en una variable primero:

```powershell
$site = "C:\Users\David\Local Sites\figma-staging\app\public"
& "C:\TRABAJOS\wp-flujo\herramientas\wp-cli\wp.cmd" core version --path=$site
```

## Lo que hay que saber

**Los comandos que tocan la base de datos necesitan que el sitio esté ARRANCADO en Local**
(botón *Start site*). Los que solo leen ficheros funcionan con el sitio parado.

Cómo distinguir el error:

| Mensaje | Significa |
|---|---|
| `mysqli_real_connect(): conexión denegada` | el sitio está parado — arráncalo en Local; si ya está arrancado, es el puerto (ver abajo) |
| `missing the MySQL extension` | el `php.ini` no se está aplicando — revisa la ruta en `wp.cmd` |
| `This does not seem to be a WordPress installation` | el `--path` está mal escrito o mal entrecomillado |

## El puerto de MySQL: `WP_MYSQL_PORT`

Local no usa el 3306: **da a cada sitio un puerto propio**. Si el sitio está arrancado y aún sale
"conexión denegada", es esto. El puerto está en `sites.json`, dentro de
`services.mysql.ports.MYSQL`:

```powershell
Get-Content "$env:APPDATA\Local\sites.json" | ConvertFrom-Json
```

Se le pasa a `wp.cmd` por una variable de entorno, y él se encarga del resto:

```powershell
$env:WP_MYSQL_PORT = "10011"
& "C:\TRABAJOS\wp-flujo\herramientas\wp-cli\wp.cmd" option get siteurl --path=$site
```

`herramientas/config-tema.js` lo resuelve solo: lee `sites.json`, encuentra el sitio por su ruta y
define la variable antes de llamar. Si escribes un script propio que use `wp.cmd`, copia ese
mecanismo en vez de escribir el puerto a mano.

**Ojo al comprobar si la base de datos responde:** `wp core version` lee un fichero, no la base de
datos, así que funciona igual con el sitio parado. Para saber si responde de verdad hay que pedirle
un dato: `wp option get siteurl`.

## Por qué existe el php.ini de esta carpeta

El PHP de Local, lanzado en seco, arranca **sin ninguna extensión**: WordPress no puede ni
conectar a la base de datos. El `php.ini` de esta carpeta carga las que hacen falta.

Dos de ellas merecen atención: **`gd` y `exif`**. Sin ellas `wp media import` sube la imagen pero
**no genera los tamaños responsive**, y no da ningún error. Es el fallo silencioso de `srcset` que
la investigación del flujo señalaba como causa de degradación.

## Si actualizas Local

La ruta lleva la versión de PHP dentro (`php-8.2.29+0`). Al actualizar Local esa carpeta cambia de
nombre y los scripts dejan de encontrarla — darán un ERROR claro diciendo qué ruta esperaban.
Hay que corregir la versión en dos sitios: `wp.cmd` y `php.ini`.
