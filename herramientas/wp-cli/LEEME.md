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
| `mysqli_real_connect(): conexión denegada` | el sitio está parado — arráncalo en Local |
| `missing the MySQL extension` | el `php.ini` no se está aplicando — revisa la ruta en `wp.cmd` |
| `This does not seem to be a WordPress installation` | el `--path` está mal escrito o mal entrecomillado |

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
