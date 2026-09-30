# Iteraciones de mejora

## Cómo leer estas iteraciones

Cada iteración registra un supuesto, una observación, una corrección y una comprobación. No se presenta el primer prompt como definitivo: la versión final se encuentra en las fichas `01` a `05`, dentro de la sección **Prompt final** con formato XML.

## Iteración 1: importación

- Prompt inicial: importar las filas 5–101 como servicios.
- Problema observado: las celdas combinadas producirían registros duplicados y no explicarían las filas de continuación.
- Prompt revisado: resolver rangos combinados por celda ancla, crear solo códigos distintos y registrar filas sin código como observaciones.
- Resultado comprobado: 12 niveles 1, 46 niveles 2 y 0 duplicados.

## Iteración 2: seguridad

- Prompt inicial: ocultar acciones de edición para el rol consulta.
- Problema observado: ocultar botones no protege el servidor.
- Prompt revisado: aplicar `AuthGuard` y `RolesGuard` a cada endpoint, además de ocultar controles en React.
- Resultado comprobado: el rol consulta puede leer y recibe HTTP 403 al intentar crear un servicio.

## Iteración 3: operación del Excel

- Supuesto inicial: bastaba con conservar un único archivo conocido y ejecutar el importador.
- Problema observado: un Excel reemplazado podía tener hoja, encabezados, tipos o umbrales inválidos.
- Prompt revisado: validar archivo, hoja, encabezados A4:L4, rango, códigos, tipos y `MINIMO <= MAXIMO` antes de crear `import_runs`.
- Resultado comprobado: `validate-import.js` produce un reporte JSON y bloquea archivos estructuralmente inválidos.

## Iteración 4: sincronización incremental

- Supuesto inicial: una segunda carga podía actualizar todos los códigos existentes.
- Problema observado: un archivo sin cambios produciría escrituras innecesarias y no distinguiría cambio real de repetición.
- Prompt revisado: comparar campos importables por código; actualizar solo modificados, omitir iguales, agregar nuevos y conservar ausentes.
- Resultado comprobado: una carga idéntica termina con `updated: 0`, `skipped: 46`; la base conserva 12/46/0/3.

## Iteración 5: harness reproducible

- Supuesto inicial: ejecutar algunos comandos manualmente era suficiente.
- Problema observado: no había una secuencia única ni un fallo claramente atribuible.
- Prompt revisado: ordenar typecheck, build, auditoría, Compose, validación, aceptación, smoke y persistencia; detenerse ante un fallo.
- Resultado comprobado: `HARNESS_RUN_SMOKE=1 npm run harness` devuelve `ok: true` con todos los controles en código cero.
