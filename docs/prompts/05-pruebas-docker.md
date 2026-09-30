# Prompt 05: pruebas, Docker y harness

## Propósito

Crear una rutina que permita a otra persona levantar, verificar y repetir el proyecto sin depender de una herramienta de IA.

## Contexto suministrado

- Docker Desktop como requisito de ejecución.
- PostgreSQL con volumen.
- API y frontend separados.
- Migraciones automáticas.
- Seed e importación ejecutables.
- Escenarios P01–P12.
- Validación previa de un Excel reemplazado.
- Necesidad de conservar el volumen durante pruebas.

## Prompt utilizado

~~~text
Define un harness para este proyecto con Docker Compose, migración, seed, validación estructural del Excel, importación incremental, typecheck, build, auditoría de secretos, smoke tests y verificación de persistencia. Cada control debe tener comando, salida observable, código de salida y no destruir el volumen automáticamente. Documenta el ciclo de corrección exigido dentro del harness: tarea, cambio propuesto por IA, controles, fallo, corrección y nueva ejecución satisfactoria.
~~~

## Restricciones

- No ejecutar down -v automáticamente.
- No publicar secretos.
- No afirmar resultados que no se ejecutaron.
- No depender de una suscripción de IA.
- Separar el flujo normal del flujo destructivo.

## Salida esperada

- scripts/harness.mjs;
- validate-import.js;
- AGENTS.md;
- compose.yaml;
- Dockerfiles;
- comandos de logs;
- evidencia de un fallo corregido;
- resultado de smoke e importación.

## Criterio de aceptación

El harness debe detenerse en el primer fallo, mostrar el paso responsable y finalizar con un objeto ok true cuando todo termina correctamente.

## Resultado aplicado

El harness ejecuta typecheck, build, secret-audit, compose-config, validación del Excel, aceptación funcional P01–P11, smoke opcional y persistencia. La evidencia de la ruta de migración corregida, la validación del archivo y la verificación final está en docs/evidencias/ciclo-harness.md.
