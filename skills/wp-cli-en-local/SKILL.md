---
name: wp-cli-en-local
description: Ejecuta wp-cli y PHP usando los que ya trae Local WP, sin instalar nada y sin abrir el site shell de la interfaz. Úsala antes de proponer cualquier comando `wp` o `php` en esta máquina, y siempre que aparezca "no tengo wp-cli", "wp no se reconoce", "falta PHP" o un error de conexión a la base de datos de WordPress — incluso con el sitio ya arrancado.
version: 0.2.0
---

# wp-cli y PHP en esta máquina

**No hace falta instalar nada.** Local WP trae PHP y wp-cli dentro. Verificado el 27/08/2026:
**PHP 8.2.29** y **WP-CLI 2.12.0**. Nunca le digas al usuario que le falta wp-cli: lo tiene.

Tampoco hace falta abrir el *site shell* de la ventana de Local — eso era un paso de más.

## El comando

```
herramientas\wp-cli\wp.cmd <comando de wp-cli> --path="C:\Users\<usuario>\Local Sites\<sitio>\app\public"
herramientas\wp-cli\php.cmd -v
```

Desde PowerShell, si la ruta lleva espacios, guárdala primero en una variable:

```powershell
$site = "C:\Users\David\Local Sites\<sitio>\app\public"
& "C:\TRABAJOS\wp-flujo\herramientas\wp-cli\wp.cmd" core version --path=$site
```

**Desde Git Bash hay que tener cuidado con las comillas al pasar por `cmd`.** Envolver con
`cmd //c "..."` puede partir un `--path` con espacios (por ejemplo "Local Sites") en argumentos
sueltos — pasó de verdad probando `wp doctor`. Si el `--path` sale mal interpretado, o para
cualquier comando que use un sitio, usa siempre PowerShell.

## La condición que hay que recordar

Los comandos que **leen o escriben en la base de datos** necesitan que el sitio esté **arrancado**
en Local (botón *Start site*). Los que solo leen ficheros funcionan con el sitio parado.

| Mensaje de error | Qué significa |
|---|---|
| `mysqli_real_connect(): conexión denegada` | el sitio está parado — pídele al usuario que lo arranque en Local. **Si ya está arrancado, ver «El puerto de MySQL» abajo antes de asumir que está parado** |
| `missing the MySQL extension` | no se está aplicando el `php.ini` — revisa la ruta dentro de `wp.cmd` |
| `This does not seem to be a WordPress installation` | el `--path` está mal escrito o mal entrecomillado |

## El puerto de MySQL — Local usa uno distinto por sitio

**Verificado el 21/09/2026, y cuesta caro no saberlo:** con el sitio arrancado de verdad en Local,
`wp-cli` puede seguir dando `mysqli_real_connect(): conexión denegada`. La causa no es que el sitio
esté parado — es que Local levanta MySQL en un **puerto propio por sitio** (no el 3306 de fábrica),
y `wp.cmd`/`php.cmd` no lo adivinan solos.

El puerto real está en `%APPDATA%\Local\sites.json`, bajo `services.mysql.ports.MYSQL`. Con dos
sitios en la máquina, cada uno tiene el suyo (medido: 10011 y 10005 — no hay un puerto fijo que
memorizar, hay que leerlo).

`wp.cmd`/`php.cmd` **ya saben usarlo**: aceptan la variable de entorno `WP_MYSQL_PORT` y, si está
definida, se la pasan a PHP como `mysqli.default_port`. Solo falta acordarse de ponerla:

```powershell
$env:WP_MYSQL_PORT = "10011"   # el de ESTE sitio, leído de sites.json
& "C:\TRABAJOS\wp-flujo\herramientas\wp-cli\wp.cmd" option get siteurl --path=$site
```

Sin la variable, cualquier comando que toque la base de datos falla con el mismo mensaje que «el
sitio está parado» — y el sitio puede estar perfectamente arrancado. Compruébalo primero con
`sites.json` antes de pedirle al usuario que reinicie nada.

## Importar SVG con `wp media import`: hace falta `--user`

**Verificado el 21/09/2026.** Si el sitio tiene `safe-svg` (u otro plugin que exige capacidad de
subir SVG), `wp media import fichero.svg` falla con *"Sorry, you are not allowed to upload SVG
files"* — wp-cli corre sin usuario autenticado por defecto, y esos plugins comprueban capacidades
de usuario, no solo el tipo de fichero. La imagen normal (JPG, PNG, WebP) sube igual sin `--user`;
solo el SVG lo exige:

```
wp media import logo.svg --user=1 --path=...
```

`--user=1` basta si es el administrador; si no, usar el `user_login` de alguien con permiso.

## Por qué existe un php.ini propio

El PHP de Local, lanzado en seco, arranca **sin ninguna extensión**: WordPress no puede ni conectar
a la base de datos. `herramientas/wp-cli/php.ini` carga las necesarias.

Dos son críticas: **`gd` y `exif`**. Sin ellas `wp media import` sube la imagen pero **no genera
los tamaños responsive**, sin dar ningún error — el fallo silencioso de `srcset`.

## Al actualizar Local

La ruta incluye la versión de PHP (`php-8.2.29+0`). Cuando Local se actualice, esa carpeta cambia
de nombre y los envoltorios darán un ERROR indicando qué ruta esperaban. Hay que corregir la
versión en dos ficheros: `herramientas/wp-cli/wp.cmd` y `herramientas/wp-cli/php.ini`.

## wp doctor ya está instalado

Verificado el 27/08/2026: `wp doctor list` responde con las 16 comprobaciones disponibles
(autoload options, cron, actualizaciones de plugin/tema, PHP en `uploads/`...).

Fijado a la versión **`2.3.0`** — la rama `dev-main` exige WP-CLI ^3.0 y aquí hay 2.12.0. Si hace
falta reinstalarlo en otra máquina, usar exactamente esa versión:

```
wp package install wp-cli/doctor-command:2.3.0
```

Instalarlo sin fijar versión (`wp package install wp-cli/doctor-command` a secas) falla con un
error de dependencias.
