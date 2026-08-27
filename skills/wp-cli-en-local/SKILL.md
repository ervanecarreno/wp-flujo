---
name: wp-cli-en-local
description: Ejecuta wp-cli y PHP usando los que ya trae Local WP, sin instalar nada y sin abrir el site shell de la interfaz. Úsala antes de proponer cualquier comando `wp` o `php` en esta máquina, y siempre que aparezca "no tengo wp-cli", "wp no se reconoce", "falta PHP" o un error de conexión a la base de datos de WordPress.
version: 0.1.0
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

Desde Git Bash hay que tener cuidado con las comillas al pasar por `cmd`; si el `--path` sale
mal interpretado, usa PowerShell.

## La condición que hay que recordar

Los comandos que **leen o escriben en la base de datos** necesitan que el sitio esté **arrancado**
en Local (botón *Start site*). Los que solo leen ficheros funcionan con el sitio parado.

| Mensaje de error | Qué significa |
|---|---|
| `mysqli_real_connect(): conexión denegada` | el sitio está parado — pídele al usuario que lo arranque en Local |
| `missing the MySQL extension` | no se está aplicando el `php.ini` — revisa la ruta dentro de `wp.cmd` |
| `This does not seem to be a WordPress installation` | el `--path` está mal escrito o mal entrecomillado |

## Por qué existe un php.ini propio

El PHP de Local, lanzado en seco, arranca **sin ninguna extensión**: WordPress no puede ni conectar
a la base de datos. `herramientas/wp-cli/php.ini` carga las necesarias.

Dos son críticas: **`gd` y `exif`**. Sin ellas `wp media import` sube la imagen pero **no genera
los tamaños responsive**, sin dar ningún error — el fallo silencioso de `srcset`.

## Al actualizar Local

La ruta incluye la versión de PHP (`php-8.2.29+0`). Cuando Local se actualice, esa carpeta cambia
de nombre y los envoltorios darán un ERROR indicando qué ruta esperaban. Hay que corregir la
versión en dos ficheros: `herramientas/wp-cli/wp.cmd` y `herramientas/wp-cli/php.ini`.

## Todavía sin instalar

`wp doctor` (fase 7 del flujo) es un paquete aparte:
`wp package install wp-cli/doctor-command`. Descarga de internet — **pedir permiso al usuario antes
de ejecutarlo.**
