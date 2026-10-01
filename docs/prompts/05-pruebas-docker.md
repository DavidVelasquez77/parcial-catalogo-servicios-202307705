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

## Prompt inicial representativo

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

- scripts/harness-docker.ps1 y scripts/harness-docker.sh;
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

El harness Docker-only ejecuta Compose, construcción y migración automática, validación del Excel, seed, importación, verificación, aceptación funcional P01–P11, smoke, auditoría de secretos y persistencia. La evidencia de la ruta de migración corregida, la validación del archivo y la verificación final está en docs/evidencias/ciclo-harness.md.

## Prompt final

~~~xml
<prompt id="05-pruebas-docker" version="final">
  <role>
    <name>Ingeniero de calidad, reproducibilidad y Harness Engineering</name>
    <responsibility>
      Diseñar una rutina que permita levantar, probar, diagnosticar y repetir el proyecto sin depender de una herramienta de IA.
    </responsibility>
  </role>
  <objective>
    Crear un harness que ejecute controles en orden, detenga el flujo ante fallos,
    muestre resultados observables y proteja los datos persistentes durante la evaluación.
  </objective>
  <project_context>
    <runtime>Docker Desktop + Docker Compose</runtime>
    <services>frontend React, API NestJS y PostgreSQL 16</services>
    <startup>migración automática antes de iniciar NestJS</startup>
    <source_file>data/CatalogoServicios.xlsx</source_file>
    <tests>P01–P12</tests>
    <scripts>
      migrate, seed-demo, validate-import, import-catalog, verify-import,
      acceptance, smoke, persistence-check, audit-secrets
    </scripts>
  </project_context>
  <control_sequence>
    <control order="1" name="compose-config">Compose resuelve la configuración.</control>
    <control order="2" name="build-up-migrate">Docker construye API y frontend, levanta dependencias y aplica la migración automática.</control>
    <control order="3" name="import-validation">El Excel cumple hoja, columnas, tipos y estructura antes de importar.</control>
    <control order="4" name="seed-import-reimport-verify">Los datos demo se preparan, el Excel se sincroniza dos veces y la segunda ejecución omite los 46 registros idénticos sin duplicarlos.</control>
    <control order="5" name="acceptance">P01–P11 se cumplen por HTTP y base real.</control>
    <control order="6" name="smoke">El recorrido crítico responde correctamente.</control>
    <control order="7" name="secret-audit">No hay secretos reales versionados.</control>
    <control order="8" name="persistence">Los conteos sobreviven al reinicio controlado.</control>
  </control_sequence>
  <failure_policy>
    <rule>Detenerse en el primer control con código distinto de cero.</rule>
    <rule>Mostrar el nombre del paso responsable y conservar su salida.</rule>
    <rule>No ejecutar una etapa posterior que pueda contaminar la evidencia.</rule>
    <rule>Conservar datos ACC- si una aceptación falla para permitir diagnóstico.</rule>
    <rule>No destruir postgres_data automáticamente.</rule>
    <rule>Distinguir éxito, advertencia y fallo bloqueante.</rule>
  </failure_policy>
  <harness_cycle>
    <plan>Definir cambio, riesgo, control y criterio de aceptación.</plan>
    <act>Aplicar cambio de forma acotada y versionable.</act>
    <observe>Ejecutar controles, logs y comandos relevantes.</observe>
    <evaluate>Comparar resultados con invariantes y requisitos.</evaluate>
    <correct>Corregir la causa del fallo, no esconder el mensaje.</correct>
    <reevaluate>Repetir controles y documentar el resultado.</reevaluate>
  </harness_cycle>
  <constraints>
    <constraint>No ejecutar down -v como parte del flujo normal.</constraint>
    <constraint>No depender de una suscripción o clave de proveedor de IA.</constraint>
    <constraint>No declarar pruebas que no se hayan ejecutado.</constraint>
    <constraint>No publicar .env ni credenciales reales.</constraint>
    <constraint>No mezclar smoke con aceptación destructiva sin datos controlados.</constraint>
    <constraint>No ocultar fallos mediante comandos que siempre devuelvan cero.</constraint>
  </constraints>
  <deliverables>
    <deliverable>scripts/harness-docker.ps1 y scripts/harness-docker.sh con pasos ordenados.</deliverable>
    <deliverable>Compose y Dockerfiles reproducibles.</deliverable>
    <deliverable>Comandos de validación, aceptación, smoke y persistencia.</deliverable>
    <deliverable>Salida JSON o código de salida que permita interpretar cada control.</deliverable>
    <deliverable>Evidencia de al menos un fallo real, su corrección y re-ejecución satisfactoria.</deliverable>
    <deliverable>Documentación de operación para una persona evaluadora.</deliverable>
  </deliverables>
  <acceptance_criteria>
    <criterion>El harness muestra el paso actual y se detiene ante un fallo.</criterion>
    <criterion>La ejecución completa termina con ok true y todos los códigos en cero.</criterion>
    <criterion>La validación del Excel ocurre antes de la importación.</criterion>
    <criterion>La aceptación cubre autenticación, roles, organización, importación y reglas de negocio.</criterion>
    <criterion>La persistencia conserva 12/46/0/3 después del reinicio.</criterion>
    <criterion>La auditoría no confunde un .env local ignorado con un secreto publicado.</criterion>
  </acceptance_criteria>
  <validation>
    <command>&amp; .\scripts\harness-docker.ps1</command>
    <command>sh scripts/harness-docker.sh</command>
  </validation>
  <response_format>
    Reportar controles ejecutados, códigos de salida, resultados JSON,
    fallos observados, correcciones aplicadas y estado final de los contenedores.
  </response_format>
</prompt>
~~~

## Verificación y artefactos

- Harness oficial: `scripts/harness-docker.ps1` y `scripts/harness-docker.sh`.
- Atajo local opcional: `scripts/harness.mjs`.
- Auditoría: `scripts/audit-secrets.mjs`.
- Aceptación: `apps/api/src/scripts/acceptance.ts`.
- Persistencia: `scripts/persistence-check.mjs`.
- Evidencia narrativa: `docs/evidencias/ciclo-harness.md`.
