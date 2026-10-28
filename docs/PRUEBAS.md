# Pruebas y evidencia reproducible

## Entorno, fecha y comandos

El 26 de octubre de 2026 (Guatemala; salida UTC del contenedor: 27 de octubre), sobre el contenido versionado en `677c807`, se ejecutó la suite en el proyecto Compose **aislado** `service-desk-suite-202307705`: PowerShell `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1`. La variante Linux/macOS es `sh scripts/service-desk-test.sh`. Usa PostgreSQL 16 Alpine, API Node 22 y los Excel originales montados de solo lectura. El proyecto de pruebas no comparte los volúmenes de la aplicación normal. La salida final fue `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}` y código 0. Una falla lanza error y termina distinto de 0.

La rutina ejecutó dos importaciones de catálogo (12/46 y 3 en revisión), dos importaciones de `CMDB.xlsx` (2 CI originales, 2 observaciones por ejecución, sin duplicados), dos generaciones de semilla `EVAL2026` (5,000 dispositivos; segunda ejecución `created=0, skipped=5000`), y preparó siete colas y 37 tickets de ejemplo. En esta repetición la fuente CMDB ya estaba cargada: ambas ejecuciones informaron `created=0, updated=0, skipped=2, observed=2`. El SHA-256 del Excel fue `d182796bb40b492be2cb87e2c5fe19a8f910f2e754183dc48b5e89bd360464dc`.

| ID | Entrada / resultado esperado | Resultado observado y punto de código |
|---|---|---|
| P01 | Sesión válida e inválida; sin sesión, consulta e inactivo rechazados | PASS; `auth`, `users`, `desk-acceptance.ts` |
| P02 | Reimportación del catálogo sin duplicar y 12/46 | PASS; 12, 46, 3 REVIEW, observaciones; `import-catalog.ts` |
| P03 | Generar 5,000 códigos únicos, repetir sin nuevos | PASS; `total=5000`, `unique_codes=5000`; `generate-cmdb.ts` |
| P04 | Raíces del Excel, dos CI originales, padre inválido y ciclo rechazados | PASS; `CmdbService`, `import-cmdb.ts` |
| P05 | Ticket con referencias válidas, rechazo de servicio inexistente y adjuntos con descarga autorizada, fechas inválidas rechazadas y filtros combinados | PASS; `DeskService.createTicket/uploadAttachment/attachment` |
| P06 | Cola por usuario y rol; acceso permitido/denegado | PASS; `queue_grants`, guardas de `DeskService` |
| P07 | Orden prioridad/antigüedad; reclamo concurrente único | PASS; respuestas `[409,201]`, `SELECT ... FOR UPDATE` |
| P08 | Transferencia con motivo/historial; otro proceso rechazado | PASS; `DeskService.transfer` |
| P09 | Ruta de los siete procesos y transición imposible | PASS; `process-rules.ts`, `DeskService.transition` |
| P10 | Cambio prematuro y autoaprobación de acceso rechazados | PASS; validaciones de transición |
| P11 | E0–E3; E2/E3 con un incidente y notificación | PASS; `ensureEventIncident` y `ticket_notifications` |
| P12 | I0–I6, regla del hueco temporal | PASS; `incident-rules.ts`, `PROJECT_GAP_RULE_7_TO_30_DAYS` |
| P13 | Incidente, problema y cambio relacionados | PASS; dos vínculos recuperados por API |
| P14 | CI, servicio e impacto; edición y clasificación completa; ciclo técnico rechazado | PASS; `CmdbService.item/updateItem/relation/impact` |
| P15 | Cierre inválido, reapertura y actor en bitácora | PASS; `reopen_count=1` y `ticket_history` |
| P16 | Dos páginas distintas de 25 sobre más de 5,000 CI | PASS; primera consulta 12 ms observados, API interna Docker/PG16; es una medición puntual, no una garantía de rendimiento |
| P17 | Primera atención, resolución con pausa, abierto sin promedio | PASS; 30 y 80 min; abierto `null` para promedio de resolución |
| P18 | Reiniciar DB y API conservando datos | PASS; 12 niveles 1, 46 nivel 2, 5,000 dispositivos, 2 CI fuente, 217 tickets, 747 eventos de historial, 19 colas en el proyecto de pruebas ya reutilizado |

El código de P01–P17 está en `apps/api/src/scripts/desk-acceptance.ts`; el de P18 en `scripts/service-desk-test.ps1`, `.sh` y `desk-persistence.ts`. Cada ejecución crea IDs con marca propia para evitar colisiones dentro de la base de pruebas. Se puede ejecutar otra vez: los resultados y totales dinámicos aumentan por las pruebas que crean tickets, no por duplicación de los 5,000 dispositivos ni de los dos Excel.

## Pruebas unitarias, integración y navegador

Desde la raíz, con **PowerShell**:

```powershell
.\scripts\test-pyramid.ps1 unit
.\scripts\test-pyramid.ps1 integration
.\scripts\test-pyramid.ps1 e2e
.\scripts\test-pyramid.ps1 all
```

Con **Linux/macOS**:

```sh
sh scripts/test-pyramid.sh unit
sh scripts/test-pyramid.sh integration
sh scripts/test-pyramid.sh e2e
sh scripts/test-pyramid.sh all
```

Estos comandos heredados del catálogo ejecutan Jest (unitarias e integración) y Playwright en contenedores. La proporción 70/20/10 describe su conjunto original de 7/2/1 escenarios; la ampliación añade 6 unitarias de reglas Service Desk y dos recorridos Playwright adicionales, así que la proporción aritmética del conjunto total cambia. No se presentan porcentajes artificiales para la ampliación. La suite P01–P18 es aceptación de API y persistencia separada.

Comprobaciones ejecutadas de la ampliación: `docker compose -p service-desk-suite-202307705 exec -T api node_modules/.bin/jest --config apps/api/test/jest.unit.config.js --runInBand`: **3 suites y 13 pruebas pasadas** (salida 27 de octubre UTC); `WEB_PORT=8081 docker compose -p service-desk-suite-202307705 --profile tests run --build --rm -T e2e`: **3 pruebas Playwright pasadas** (Playwright 1.64.1, imagen `v1.64.1-noble`), catálogo, portal Service Desk y mantenimiento visual de categoría/cola. En PowerShell, defina primero `$env:WEB_PORT='8081'` si ejecuta ese comando suelto y ya está ocupado el 8080. `npm run typecheck` pasó en API y web. Para auditar archivos versionados sin Node en el anfitrión: `docker run --rm --mount type=bind,source="${PWD}",target=/workspace,readonly --workdir /workspace node:22-alpine node scripts/audit-secrets.mjs` (en PowerShell, `${PWD}` se puede reemplazar por `$((Get-Location).Path)`).

## Criterio de salida y límites

El criterio de salida fue código 0 para cada rutina, P01–P18 PASS, 5,000 dispositivos únicos, 12/46 de catálogo, dos CI originales, tres pruebas Playwright y 13 Jest. `scripts/service-desk-test.*` nunca ejecuta `down -v`. Para reiniciar solo el conjunto desechable, use explícitamente `docker compose -p service-desk-suite-202307705 down -v`; esto **destruye datos de ese proyecto de pruebas**. Las pruebas de interfaz cubren recorrido principal; no afirman inspección visual manual exhaustiva ni una prueba de carga.

La matriz aquí vincula requisito → implementación → ejecución → salida verificable. Las decisiones y fórmulas están en [PROCESOS.md](PROCESOS.md), el modelo en [MODELO.md](MODELO.md), y los ciclos de corrección en [IA.md](IA.md).

Controles adicionales sobre `677c807`: `npm run lint`, `npm run typecheck`, `npm run audit:secrets` y `npm audit --audit-level=high` terminaron con código 0; la auditoría informó `found 0 vulnerabilities`.

## Revisión de fuentes y corrección CMDB (26 de octubre de 2026, Guatemala)

El código de esta revisión quedó fijado después de las pruebas en `13b27c1`;
el diagrama y las transcripciones originales habían quedado antes en
`77bef42`. La correspondencia con la lección 22, la aclaración oral de la
lección 25 y las celdas B4:U6 está en [CMDB_JERARQUIA.md](CMDB_JERARQUIA.md).
Esta sección es evidencia nueva; no reemplaza ni cambia los resultados
históricos de `677c807` descritos arriba.

| Control ejecutado | Entrada y criterio | Salida observada |
|---|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` | Proyecto Compose aislado; Excel de catálogo y CMDB repetidos, semilla EVAL2026 y P01–P18 | Código 0; `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}`. 12/46 servicios, dos CI originales, 5,000 dispositivos únicos. |
| P04 dentro de la suite | Hardware y Software con origen `EXCEL`; las cuatro hojas generadas con origen `PROJECT`; J5:J6 sin padres/hijos; ubicación recuperable; duplicado, padre inexistente y ciclo rechazados | `{"id":"P04","result":"PASS"}`. |
| P14 dentro de la suite | Renombrar ubicación vinculada y auditar el cambio; bloquear su desactivación; impedir segundo padre, ciclo de composición y ciclo mixto `DEPENDS_ON`/`HOSTED_ON`; recorrer CI → servicio | `{"id":"P14","result":"PASS"}`. Las escrituras inválidas devolvieron 409. |
| P16 y P17 dentro de la suite | Paginación y métricas controladas | P16 PASS, 13.9 ms en una consulta interna puntual con Docker/PostgreSQL 16 Alpine; P17 PASS, primera atención 30 min y resolución 80 min. |
| P18 dentro de la suite | Reiniciar DB y API sin borrar volúmenes | PASS; después del reinicio: 12 nivel 1, 46 nivel 2, 5,000 dispositivos, 2 CI fuente, 281 tickets, 1,012 entradas de historial y 23 colas. Los últimos tres totales incluyen ejecuciones anteriores de la suite aislada. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 all` | Unitarias Jest, integración con Excel/PostgreSQL y navegador Playwright | Código 0; 13 unitarias, 2 de integración y 3 E2E. El tercer E2E creó y editó categoría, ubicación y cola desde la interfaz. |
| `docker compose -p service-desk-suite-202307705 exec -T -w /app/apps/api api npm run lint` | ESLint dentro del contenedor con `eslint.config.js` incluido en la imagen | Código 0. La primera ejecución manual falló porque faltaba copiar ese archivo al contenedor; se corrigió el Dockerfile y se repitió satisfactoriamente. |
| `npm run audit:secrets` y `docker compose ps` | No publicar secretos; aplicación normal disponible | Auditoría código 0, `{"ok":true,"scanned":"source, configuration and documentation"}`; web, API y DB activos; GET `http://localhost:8080/` devolvió 200. |

La prueba final de aceptación se ejecutó sobre un proyecto **aislado ya
existente**. Por ello los importadores informaron `skipped=46` y `skipped=2`
en vez de nuevos registros; las observaciones se siguieron registrando. La
migración 005 se aplicó sobre la base de esa suite sin borrar datos. El README
describe la creación desde un volumen vacío; esta ejecución específica
comprueba la actualización de un entorno persistente, no una clonación nueva.

## Cierre de tickets y trazabilidad (27 de octubre de 2026, Guatemala)

La corrección del apartado 4 quedó en el commit de código `eac5e25`. Se agregó
`POST /api/desk/tickets/:id/escalate` para incidentes: el servidor exige
permiso `can_transfer`, motivo, estado válido y una cola activa del mismo
proceso con nivel de soporte estrictamente superior. La transición directa a
`ESCALATED` se rechaza. La ficha ahora ofrece únicamente destinos válidos y
permite desplegar los valores anteriores y nuevos de la bitácora junto al
nombre del actor. Pausa, reanudación, asignación, transición y vinculación de
CI guardan los cambios de sus campos relevantes; los tickets de ejemplo en
estado `ESCALATED` se ubican en la cola de incidentes de nivel 2.

| Comando o escenario | Resultado real observado |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` | Código 0; `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}`. Se reutilizó el volumen **aislado** de pruebas: importación del catálogo con 12/46, 3 REVIEW y `skipped=46`; CMDB con dos CI originales y 5,000 dispositivos únicos. |
| P08 | PASS. Se rechazó pasar directamente a `ESCALATED`, escalar a una cola del mismo nivel, hacerlo sin permiso y omitir el motivo. Se aceptó el traslado del nivel 1 al 2 y se verificaron estado, cola, actor, nivel anterior/nuevo y cola anterior/nueva. El ticket de muestra `DEMO-INC-05` quedó en nivel 2. |
| P15 | PASS. Pausa y reanudación conservaron actor y valores anteriores/nuevos; el cierre inválido se rechazó y la reapertura incrementó `reopen_count` a 1. |
| P18 | PASS tras reiniciar PostgreSQL y API sin borrar el volumen: 12 nivel 1, 46 nivel 2, 5,000 dispositivos, 2 CI originales, 323 tickets, 1,199 entradas de historial y 28 colas. Tickets, historial y colas adicionales incluyen ejecuciones previas de la suite aislada. |
| `npm run typecheck`, `npm run lint`, `npm run audit:secrets`, `git diff --check` y `npm run build --workspace apps/web` | Todos terminaron con código 0. La auditoría devolvió `{"ok":true,"scanned":"source, configuration and documentation"}` y la compilación web transformó 1,632 módulos. |
| `docker compose up --build -d`, `docker compose exec -T api node apps/api/dist/scripts/seed-service-desk.js`, GET `http://localhost:8080/` | Aplicación normal reconstruida sin borrar datos; semilla repetida con `created=0`, 37 tickets de muestra y ocho colas preparadas; la web respondió HTTP 200. |

La suite P01–P18 prueba la API y persistencia; la compilación confirma que el
nuevo componente de interfaz se empaqueta sin errores. Esta revisión no afirma
una prueba visual manual completa del nuevo control de escalamiento.

## Colas, permisos y asignación (27 de octubre de 2026, Guatemala)

El cambio de código de este apartado quedó en el commit `67b2380`. Se revisó
el apartado 5 del enunciado y se completaron tres faltantes observables:
responsable obligatorio para cada cola, administración delegada mediante
`can_admin` y dos reglas configurables de orden. Se añadió la asignación
dirigida a un agente autorizado, además de `claim`. La migración 006 conserva
las colas anteriores y asigna un responsable activo a las que ya existían;
la semilla de demostración garantiza acceso individual de consulta y atención
para ese responsable. La política manual y los bloqueos de baja se describen
en [PROCESOS.md](PROCESOS.md#colas-autorización-y-asignación).

| Comando o escenario | Resultado observado |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` | Código 0. P01–P18 PASS; salida final `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}`. Se reutilizó el volumen aislado de pruebas. |
| P06 dentro de la suite | PASS. Sin responsable o con responsable `CONSULTA`: 400. Código duplicado: 409. Responsable activo y regla `AGE_PRIORITY`: creación correcta. Su acceso individual se verificó y su revocación: 409. Un agente con `can_admin` editó la cola y gestionó permisos; otro sin el permiso recibió 403. `CONSULTA` no pudo obtener permisos de escritura. La baja de una cola con tickets abiertos y la desactivación de su responsable se rechazaron con 409. |
| P07 dentro de la suite | PASS. Con filtro de cola `AGE_PRIORITY`, el ticket más antiguo encabezó la lista aunque tuviera prioridad menor; la vista global ordenó por prioridad. Dos agentes intentaron `claim` simultáneamente: respuestas `[201,409]`. Se rechazó asignar desde una cuenta sin `can_admin` y elegir al solicitante; la reasignación válida guardó actor, responsable anterior/nuevo y motivo en `ticket_history`. |
| P18 dentro de la suite | PASS después de reiniciar PostgreSQL y API sin borrar volúmenes: 12 códigos de nivel 1, 46 servicios de nivel 2, 5,000 dispositivos, dos CI del Excel original, 420 tickets, 1,594 eventos de historial y 37 colas. Los últimos tres totales incluyen ejecuciones previas de la misma suite aislada; no son cantidades de una carga limpia. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 e2e` | Código 0; **3 pruebas Playwright pasadas en 23.3 s**. Incluye el mantenimiento visual de una cola con responsable y regla de orden, además de los recorridos del catálogo y del portal Service Desk. |
| `npm run lint`, `npm run typecheck`, `npm run audit:secrets`, `git diff --check` | Código 0 en cada comando. La auditoría devolvió `{"ok":true,"scanned":"source, configuration and documentation"}`. |
| `docker compose exec -T api node apps/api/dist/scripts/seed-service-desk.js`, `docker compose ps` y GET `http://localhost:8080/` | Semilla repetida con `created=0`, 37 tickets de demostración y ocho colas. DB healthy, API y web activos; HTTP 200. El volumen normal se conservó. |

Durante la ampliación de P07, la primera versión de la prueba suponía que un
agente determinado ganaría siempre la carrera de `claim`. En una ejecución
ganó el otro y la aserción de la *prueba* falló aunque la exclusión mutua
funcionaba. Se corrigió la prueba para leer al ganador y dirigir la
reasignación al otro agente. La siguiente ejecución completa pasó. Este
fallo no fue introducido deliberadamente ni se atribuye al producto.
