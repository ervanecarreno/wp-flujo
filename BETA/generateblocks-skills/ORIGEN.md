# Origen de esta copia

Copia vendorizada de **github.com/wpgaurav/generateblocks-skills** (los cuatro paquetes de
`importable/`, descomprimidos al lado de su `.zip`). No se carga como skill del plugin: es
material de consulta, y las reglas que valen la pena se promueven a nuestras skills y herramientas.

| Campo | Valor |
|---|---|
| Release base | `v2026.09.20` |
| Commit copiado | `b57b6c2` (06/10/2026, rama `main`, sin release todavía) |
| Revisada el | 15/10/2026 |

**Comprobar si hay novedades:** `gh api repos/wpgaurav/generateblocks-skills/commits/main --jq .sha`
y comparar con el commit de arriba. Si cambia, clonar en el scratchpad, leer
`git log <commit>..HEAD` y `git diff <commit> HEAD -- skills/ CHANGELOG.md`, y sobrescribir
aquí con `unzip -o` cada `importable/<nombre>.zip` en `./<nombre>/`.

## Parches locales — reaplicar después de cada actualización

1. **`gbBlockCondition` va como texto, no como número** (las cuatro copias de `conditions.md`).
   Upstream dice «integer post ID»; GB Pro lo declara `{type:"string"}` y el editor descarta
   el número al guardar. Medido el 09/10/2026 en SC La Palma. Ver trampa 40 de
   `flujo-wordpress-generateblocks`.

## Historial

- 15/10/2026 — de `v2026.09.18` a `b57b6c2`. Lo promovido está en `ESTADO.md` (entrada del 15/10/2026).
- 22/09/2026 — primera revisión de `v2026.09.18`.
