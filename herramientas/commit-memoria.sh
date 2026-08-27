#!/usr/bin/env bash
# Commitea .claude-memory solo si ha cambiado. Pensado para un hook Stop.
#
# Defensivo por diseño: si algo no encaja (no es un repo, no hay carpeta de
# memoria, no hay cambios, git falla) sale en silencio con 0 y no molesta.
# Solo habla cuando de verdad ha commiteado algo.
set -u

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)" || exit 0
cd "$raiz" 2>/dev/null || exit 0

# ¿Es un repo git?
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
# ¿Existe la carpeta de memoria?
[ -d .claude-memory ] || exit 0

# ¿Hay algo que commitear? Tres formas de cambio: sin seguir, modificado, ya indexado.
sin_seguir="$(git ls-files --others --exclude-standard -- .claude-memory 2>/dev/null)"
if git diff --quiet -- .claude-memory 2>/dev/null \
   && git diff --cached --quiet -- .claude-memory 2>/dev/null \
   && [ -z "$sin_seguir" ]; then
  exit 0
fi

git add -- .claude-memory >/dev/null 2>&1 || exit 0

n="$(git diff --cached --name-only -- .claude-memory 2>/dev/null | wc -l | tr -d ' ')"
[ "${n:-0}" -eq 0 ] && exit 0

# Solo la ruta de memoria: no arrastra otros cambios que hubiera indexados.
git -c core.autocrlf=true commit -q \
    -m "Memoria: $n fichero(s) actualizados automaticamente al cerrar el turno" \
    -- .claude-memory >/dev/null 2>&1 || exit 0

printf '{"systemMessage":"Memoria versionada: %s fichero(s) commiteados en .claude-memory."}\n' "$n"
exit 0
