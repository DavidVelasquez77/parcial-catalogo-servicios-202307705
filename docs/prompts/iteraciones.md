# Iteraciones de mejora

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
