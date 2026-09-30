# Fase 3: Harness Engineering

## 1. Definición aplicada al proyecto

Harness Engineering es el diseño del entorno de controles que permite ejecutar, observar y repetir un cambio con seguridad. Incluye Docker, migraciones, scripts, pruebas, auditorías, datos controlados, persistencia y documentación de resultados.

El harness no es únicamente un script de pruebas ni depende de que la IA esté disponible. Debe servirle a otra persona que clone el repositorio y necesite comprobar el sistema.

## 2. Componentes del harness

| Componente | Función |
|---|---|
| `compose.yaml` | levanta API, frontend y PostgreSQL de forma reproducible |
| Dockerfiles | generan imágenes con rutas y artefactos conocidos |
| migración | crea el modelo y sus restricciones |
| `seed-demo.js` | prepara cuentas y organización de evaluación |
| `validate-import.js` | valida Excel antes de tocar la base |
| `import-catalog.js` | sincroniza nuevos, modificados e idénticos |
| `verify-import.js` | comprueba conteos y duplicados |
| `acceptance.js` | prueba contratos P01–P11 por HTTP y base real |
| `smoke.js` | ejecuta un recorrido corto de autenticación y filtros |
| `persistence-check.mjs` | reinicia servicios y comprueba el volumen |
| `audit-secrets.mjs` | detecta secretos accidentales versionados |
| `harness.mjs` | ejecuta controles en orden y detiene ante fallos |

## 3. Orden de control

~~~text
TYPECHECK → BUILD → SECRET-AUDIT → COMPOSE-CONFIG
    → IMPORT-VALIDATION → ACCEPTANCE → SMOKE → PERSISTENCE
~~~

Cada paso tiene una entrada, una salida observable y un código de salida. El siguiente paso no debe ocultar el fallo del anterior.

## 4. Tipos de resultado

- **Éxito:** código 0 y salida compatible con `ok: true`.
- **Advertencia:** el proceso puede terminar, pero deja una observación que debe revisarse, por ejemplo un nombre alternativo de SE.12.
- **Fallo bloqueante:** código distinto de cero; se detiene el flujo para evitar contaminar la evidencia.

La validación del Excel es un control especialmente importante: si fallan hoja, encabezados, tipos o estructura, no se crea `import_runs` y no se modifican servicios.

## 5. Datos controlados y no destructividad

La aceptación crea datos con prefijo `ACC-` y limpia únicamente lo que creó cuando termina correctamente. La verificación de persistencia reinicia contenedores sin ejecutar `docker compose down -v`. El volumen de PostgreSQL no se destruye automáticamente porque forma parte de lo que se quiere comprobar.

## 6. Ciclo de corrección

El ciclo utilizado dentro del harness es:

~~~text
PLAN → ACT → OBSERVE → EVALUATE → CORRECT → RE-EVALUATE
~~~

| Etapa | Aplicación práctica |
|---|---|
| Plan | definir el cambio y sus invariantes |
| Act | editar código, configuración o documentación |
| Observe | ejecutar logs, typecheck, build o prueba afectada |
| Evaluate | comparar la salida con la aceptación |
| Correct | corregir la causa, no ocultar el síntoma |
| Re-evaluate | repetir el control y registrar el resultado |

Este ciclo es parte de Harness Engineering; no se presenta como una cuarta disciplina exigida por el enunciado.

## 7. Comandos principales

~~~powershell
docker compose up --build -d
docker compose ps
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
$env:HARNESS_RUN_SMOKE='1'
npm run harness
~~~

La aceptación directa se ejecuta con `npm test` y la persistencia con `npm run persistence:check`.

## 8. Criterio de aceptación de esta fase

El harness cumple su objetivo cuando una persona puede levantar el proyecto, validar el Excel, importar, comprobar la API, ejecutar aceptación, reiniciar la base sin perder datos y recibir un resultado inequívoco ante un fallo.
