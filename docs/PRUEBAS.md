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
| P05 | Ticket con referencias válidas, rechazo de servicio inexistente y adjuntos con descarga autorizada, fechas inválidas rechazadas, filtros combinados y cinco FAQ nivel 0 visibles | PASS; `DeskService` y `seed-service-desk.ts` |
| P06 | Cola por usuario y rol; acceso permitido/denegado | PASS; `queue_grants`, guardas de `DeskService` |
| P07 | Orden prioridad/antigüedad; reclamo concurrente único | PASS; respuestas `[409,201]`, `SELECT ... FOR UPDATE` |
| P08 | Transferencia con motivo/historial; otro proceso rechazado | PASS; `DeskService.transfer` |
| P09 | Ruta de los siete procesos y transición imposible | PASS; `process-rules.ts`, `DeskService.transition` |
| P10 | Cambio prematuro y autoaprobación de acceso rechazados | PASS; validaciones de transición |
| P11 | E0 solo registro; E1 evaluación; E2/E3 incidente, notificación y respuesta | PASS; `ensureEventIncident`, `ticket_notifications`, categoría inmutable y validaciones de transiciones |
| P12 | I0–I6, solapamientos, hueco semanal/mensual y límites del mes complementario | PASS; `PROJECT_SHORTEST_MATCH`, `PROJECT_GAP_RULE_7_TO_30_DAYS`, `PROJECT_30_DAY_MONTH_THRESHOLD` |
| P13 | Incidente, problema y cambio relacionados | PASS; dos vínculos recuperados por API |
| P14 | CI, servicio e impacto; edición y clasificación completa; ciclo técnico rechazado | PASS; `CmdbService.item/updateItem/relation/impact` |
| P15 | Cierre inválido, reapertura y actor en bitácora | PASS; `reopen_count=1` y `ticket_history` |
| P16 | Dos páginas distintas de 25 sobre más de 5,000 CI | PASS; primera consulta 12 ms observados, API interna Docker/PG16; es una medición puntual, no una garantía de rendimiento |
| P17 | Antigüedad abierta, primera atención, resolución con pausa y cumplimiento de objetivos | PASS; 120, 30 y 80 min; dos objetivos evaluados y cumplidos |
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

## Siete procesos y evidencia de sus puertas (27 de octubre de 2026, Guatemala)

El código de los controles y de aceptación está en el commit `791cd76`.
La revisión del apartado 6 llevó a exigir las evidencias del flujo en la API,
además de conservar las transiciones de `process-rules.ts`. La regla por etapa
y proceso está explicada en [PROCESOS.md](PROCESOS.md#evidencia-obligatoria-y-puertas-de-transición).

| Proceso | Caso positivo comprobado | Rechazo o puerta comprobada |
|---|---|---|
| Nuevos servicios | Completa análisis, aprobación, vincula un servicio activo y también crea una propuesta en `REVIEW`; el ticket conserva el ID aprobado. | Rechaza código existente/duplicado e implementación o resolución sin el servicio aprobado y el resultado correspondiente. El ID aprobado se asigna por servidor y la base de aprobación queda bloqueada. |
| Cambios | Completa impacto, riesgo, CI, aprobación, planificación, ejecución y validación. | Intentar ejecutar sin transición de aprobación registrada devuelve 409; exige CI, riesgo, plan de pruebas, reversión y resultados de ejecución/validación. No permite alterar ese alcance ni agregar CI después de la aprobación. |
| Incidentes | Completa clasificación I0–I6, atención, solución y duración real cuando hubo interrupción. | Rechaza categoría sin indicador, duración cero o incompatible con I1–I5 y resolución sin solución o duración real. |
| Eventos | E0 se cierra tras registrarse; E1 se evalúa sin respuesta; E2/E3 generan un incidente enlazado y notificación, requieren respuesta y luego cierre. | La API impide clasificar/evaluar/responder E0, cambiar su categoría y responder E1; E2/E3 tampoco cierran antes de responder. |
| Problemas | Vincula un incidente, investiga, registra solución temporal, error conocido y solución definitiva. | Cada evidencia se exige antes de su estado; `IMPLEMENTS` se permite entre problema y cambio, no con un incidente. |
| Accesos | Completa beneficiario, recurso, permiso, GRANT/REVOKE, aprobación, provisión/revocación y validación. | Faltan datos u operación, la provisión o validación está sin evidencia, o el solicitante intenta autoaprobar: se rechaza. Recurso, permiso y operación aprobados no se alteran después de aprobar. |
| Servicios de tecnología | Valida una requisición sobre servicio existente, asigna agente, registra cumplimiento y confirmación. | Impide asignar sin agente/validación, cumplir sin agente, confirmar sin entrega o resolver sin confirmación. |

| Comando / prueba | Resultado observado |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` | Código 0; P01–P18 PASS. P09 recorrió los siete procesos e incluyó vinculación y creación de un servicio nuevo; P10 y P11–P13 pasaron sus rechazos y controles específicos. Salida final: `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}`. |
| P18 tras reiniciar PostgreSQL y API del proyecto aislado | PASS; 12 servicios nivel 1, 46 nivel 2, 5,000 dispositivos, 2 CI fuente, 545 tickets, 2,251 entradas de historial y 47 colas. El volumen de pruebas ya se había reutilizado: tickets, historial y colas son acumulados; los conteos base 12/46/5,000/2 sí se comprobaron exactamente. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 all` | Código 0; salida `{"ok":true,"suite":"all","pyramid":"70/20/10"}`. Jest: 13 unitarias y 2 de integración pasadas; Playwright: 3 recorridos de navegador pasados. |
| `npm run lint`, `npm run typecheck`, `npm run audit:secrets`, `git diff --check` | Código 0 en los cuatro; auditoría `{"ok":true,"scanned":"source, configuration and documentation"}`. El build de la API en Docker también terminó correctamente durante P01–P18. |
| `docker compose up --build -d`; seed de `seed-service-desk.js`; GET `http://localhost:8080/` | Build normal completado, semilla idempotente (`created=0`, 37 tickets de muestra y 8 colas), base healthy, API y web activos; respuesta HTTP 200. Se conservó el volumen normal. |

## Apartado 7: parámetros de Service Desk de la lección 25 (27 de octubre de 2026)

Se completaron y verificaron los parámetros operativos de las diapositivas 11–16. Las reglas fuente, decisiones del proyecto y fórmulas están separadas en [PROCESOS.md](PROCESOS.md); el hallazgo y archivos afectados están en [contexto de lección 25](contexto/05-contexto-leccion25.md).

| Requisito o riesgo detectado | Cambio implementado | Evidencia observada |
|---|---|---|
| Seis tipos de ticket y siete procesos | Tabla formal tipo→proceso en `PROCESOS.md`; `NEW_SERVICE` y `TECH_SERVICE` son subtipos de `SERVICE_REQUEST` con flujos distintos. | Unit test `desk-rules.spec.ts` compara el mapeo completo de los siete procesos. |
| E0 estaba presentado como flujo de evaluación | E0 ahora solo se registra y pasa directamente de `SUBMITTED` a `CLOSED`; la API rechaza clasificación, evaluación, respuesta y cambio de categoría. E1 exige evaluación y no respuesta. | P11 PASS; E2E valida el portal; P11 prueba rechazos de modificación y transición de E0/E1. |
| Notificación y atención de E2/E3 | La evaluación crea un incidente enlazado y una notificación para el solicitante; el endpoint autenticado `GET /api/desk/notifications` permite verificarla. | P11 PASS para E2 y E3; confirma número del evento en el mensaje y un solo enlace de incidente. No se envían correos. |
| Solapamientos, hueco temporal y umbral de I5 | Reglas identificadas como decisiones del proyecto: `PROJECT_SHORTEST_MATCH`, `PROJECT_GAP_RULE_7_TO_30_DAYS` y `PROJECT_30_DAY_MONTH_THRESHOLD`. | P12 PASS con límites 180/181, 480/481, 2880/2881, 10080/10081 y 43199/43200; cero minutos pasa a revisión manual. |
| Portal nivel 0 y tablero sin FAQ/KPI claros | La semilla idempotente crea cinco FAQ iniciales; el tablero muestra antigüedad abierta, primera atención, resolución y porcentaje de objetivos por denominador evaluable. También repara el E0 de muestra legado y deja traza si elimina evaluación/respuesta sintéticas. | P05 confirma cinco artículos y que `DEMO-EVT-01` no tenga evaluación ni respuesta; E2E verifica la FAQ, KPI y sección de objetivos. En la suite P01–P18, la reparación se ejecutó una vez (`repairedE0=1`) y la corrida posterior fue idempotente (`repairedE0=0`). |
| Fórmulas y tratamiento de pausa/reapertura | La API y la UI explican minutos calendario, pausas, eventos de reapertura y denominadores de objetivos configurados. P17 usa fechas y pausa controladas. | P17 PASS: antigüedad 120 min, primera atención 30 min, resolución 80 min; ambos objetivos 1/1. La corrida aislada más reciente pasó la pirámide 70/20/10. |
| Rutina E2E afectaba potencialmente la base habitual | `test-pyramid.ps1/.sh` ahora usan `service-desk-pyramid-202307705`, host port 18081, y paran sus contenedores al terminar sin borrar el volumen aislado. | La corrida completa de la pirámide pasó en el entorno aislado; el Compose normal en localhost:8080 no se reinició ni compartió DB. |

### Salida de la última ejecución

| Comando | Resultado del 27 de octubre de 2026 |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` | Código 0; P01–P18 PASS. P05 informó cinco FAQ; P11 eventos; P12 reglas I0–I6; P17 métricas; P18 verificó persistencia después de reiniciar PostgreSQL y API. Salida final: `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}`. Conteos P18 de esta ejecución: 12 nivel 1, 46 nivel 2, 5,000 dispositivos, 2 CI originales, 620 tickets, 2,627 entradas de historial y 53 colas; los tres últimos son acumulados del volumen aislado reutilizado. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 all` | Código 0; 13 unitarias Jest, 2 integraciones Jest y 3 pruebas Playwright. Salida: `{"ok":true,"suite":"all","pyramid":"70/20/10"}`. La última ejecución reutilizó el volumen aislado: importó de forma idempotente 12/46 servicios (46 omitidos), verificó 2 CI originales, 5,000 dispositivos existentes, 37 tickets de muestra y 5 FAQ; detuvo sus contenedores y conservó el volumen. |
| `npm run typecheck`, `npm run lint`, `npm run build`, `npm run audit:secrets`, `git diff --check` | Código 0. Vite compiló 1,632 módulos; auditoría: `{"ok":true,"scanned":"source, configuration and documentation"}`. |

### Fallo encontrado y corrección

La primera ejecución de la nueva preparación falló al sembrar FAQ: PostgreSQL
reportó `42P08` porque el parámetro `$1` se infería a la vez como `text` y
`varchar`. La transacción de la semilla se revirtió; no insertó artículos ni
alteró datos parciales. Se tiparon explícitamente los parámetros como
`varchar`, `text` y `bigint`, se repitió la rutina y pasó tanto la preparación
como toda la pirámide. No se introdujo el fallo deliberadamente.

La pirámide aislada fue probada desde cero y levantó datos en su propio volumen.
La suite P01–P18 ya había completado sus 17 escenarios funcionales y comprobó
P18 después del reinicio sin eliminar su volumen. Ambos comandos de prueba
pueden repetirse sin borrar volúmenes; para iniciar una base vacía de evaluación,
seguir el procedimiento de datos de prueba indicado en el README.

### Corrección observada durante la verificación

La primera ejecución del caso de propuesta nueva aprobó correctamente el
servicio, pero dejó el fixture en la base aislada y P18 detectó 47 servicios
nivel 2 en lugar de los 46 originales. Se ajustó la prueba para borrar solo
el servicio sintético que ella creó al cerrar el caso; no se cambió el
importador ni se tocó la base normal. Se retiró del volumen aislado el único
fixture de esa primera ejecución y la repetición completa acabó con código 0,
12/46 y P18 PASS. Este ciclo no fue un fallo deliberado.

## Apartado 8: CMDB y 5,000 dispositivos (27 de octubre de 2026)

La revisión completó la trazabilidad de los campos del libro, la consulta de
CI y la evidencia del generador. El commit de implementación probado es `f16e6d39aa25ca45ed698ddd469023718fc11780`; esta evidencia se añadió en un commit documental posterior. El archivo
fuente `data/fuentes/CMDB.xlsx` conservó su SHA-256
`d182796bb40b492be2cb87e2c5fe19a8f910f2e754183dc48b5e89bd360464dc`.
La jerarquía y la separación entre datos de origen y decisiones del proyecto
están descritas en [CMDB_JERARQUIA.md](CMDB_JERARQUIA.md) y [MODELO.md](MODELO.md).

| Comprobación | Criterio y alcance | Resultado observado |
|---|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` | Suite de aceptación P01–P18 en el Compose aislado, incluyendo generador, consultas CMDB, permisos y persistencia | Código 0; todos los escenarios PASS. P03 confirmó 5,000 dispositivos con 5,000 códigos únicos, cuatro categorías de Hardware con 1,250 dispositivos por clase, Hardware = 5,000 y Software = 0. P04 comprobó los CI originales y sus atributos/procedencia del Excel. |
| P14 dentro de la suite | Integridad, relaciones, detalle del CI e impacto | PASS: categoría y relaciones jerárquicas sin ciclos; `DEPENDS_ON` y `HOSTED_ON` rechazan ciclos; `CONNECTED_TO` permite ciclos; el recorrido atraviesa dependencias en varios saltos y encuentra un servicio potencialmente afectado. La ficha no revela tickets de colas que el usuario no puede consultar. |
| P16 dentro de la suite | Filtros, búsqueda y paginación sobre el conjunto persistido | PASS: 25 filas por página; “Hardware” incluye sus subcategorías; búsqueda por código devuelve el CI esperado y los filtros de ubicación y estado devuelven resultados coherentes. La consulta interna observada fue de 7.8 ms en una ejecución puntual; no representa una prueba de carga. |
| P18 dentro de la suite | Reinicio de PostgreSQL y API sin borrar el volumen | PASS. Persistieron 12 servicios de nivel 1, 46 de nivel 2 y los 5,000 dispositivos. Tickets, bitácoras y colas de esa ejecución provenían de un volumen de pruebas reutilizado y sus cantidades son acumuladas. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 all` | Unitarias, integración con base/datos y flujos E2E en navegador | Código 0; Jest pasó 13 pruebas unitarias y 2 de integración; Playwright pasó 3 pruebas E2E, incluida la búsqueda del CI del Excel, la ficha de origen y la navegación hacia un ticket relacionado. Salida: `{"ok":true,"suite":"all","pyramid":"70/20/10"}`. |
| `npm run lint`, `npm run typecheck` y `git diff --check` | Calidad estática y formato del cambio | Los tres controles terminaron con código 0. |
| `docker compose up --build -d` y GET a `http://localhost:8080/` | Actualización de la aplicación de evaluación habitual, conservando el volumen normal | API y web reconstruidas y reiniciadas; PostgreSQL conservó el volumen. La web respondió HTTP 200. |

El generador se repitió con la semilla `EVAL2026`: la última corrida observada
informó `created=0`, `updated=0`, `skipped=5000` y `totalForSeed=5000`, sin
duplicados. En una ejecución previa de esta revisión, 2,500 responsables
antiguos de la misma semilla se normalizaron a la cuenta local `admin.demo`;
el generador informó esas modificaciones como `updated` y dejó registro
`SYNTHETIC_OWNER_NORMALIZE` en la bitácora del CI. La siguiente repetición fue
idempotente. El generador no asigna usuarios personales, no elimina datos al
arrancar y no exige una dirección IP para todas las clases.

### Fallos encontrados y correcciones durante la revisión

El filtro por una categoría padre solo buscaba coincidencia directa y por eso
no encontraba las categorías hijas; se cambió a recorrer el subárbol y se
añadió una aserción de aceptación. La lista mostraba el identificador numérico
del responsable y la ficha resumía los campos de origen; ahora presenta el
nombre o etiqueta y los atributos del Excel junto con hoja/fila. La prueba de
aceptación verifica ambos casos. El detalle también filtraba los tickets por
visibilidad solo en la tabla general; se aplicó la misma autorización al
detalle del CI y se probó el rechazo de lectura de una cola ajena.

La prueba de actualización detectó que los campos opcionales `acquiredOn` y
`documentationUrl` no podían limpiarse porque el servidor interpretaba `null`
como “conservar valor”. Se corrigió el manejo explícito de `null` y P14 ahora
prueba tanto su establecimiento como su eliminación. Ninguno de estos fallos
se introdujo deliberadamente. Las pruebas usaron un proyecto y un volumen
aislados; la reconstrucción normal final no ejecutó `down -v` ni eliminó datos.

## Apartado 9: aplicación verificable de las cuatro ingenierías (27 de octubre de 2026)

La documentación y el ajuste de salida del harness quedaron versionados en el
commit `f245cb1` (documentación y resumen de la suite). Los cambios funcionales
a los que apuntan estas evidencias están en los commits indicados en cada
práctica. La suite se ejecutó antes del commit sobre el mismo contenido de
scripts y código; luego se registró aquí el resultado exacto. Los detalles y
límites se enlazan desde [docs/IA.md](IA.md) y [docs/ia/README.md](ia/README.md).

| Práctica | Evidencia y vínculo con cambios reales |
|---|---|
| Prompt Engineering | Ocho prompts operativos, para requisitos, CMDB, modelo, colas, procesos, seguridad, grafos y pruebas, están en [service-desk.md](prompts/service-desk.md). Cada ficha incluye objetivo, contexto, restricciones, salida esperada y aceptación, además de herramienta/modelo y periodo de uso. La ficha informa honestamente que los bloques son resúmenes editados de instrucciones aplicadas, no transcripciones literales, y que Codex no expuso la versión menor del modelo. Dos iteraciones enlazan defectos observados y resultados: contrato HTTP de transferencia (P08) y tipo SQL de transición (P09), relacionados con `fe4ea55`. |
| Context Engineering | `AGENTS.md`, el contexto maestro y [contexto de Service Desk](contexto/06-contexto-service-desk.md) reúnen fuentes, glosario, modelo, decisiones, reglas y comandos. [IA.md](IA.md) registra tres actualizaciones motivadas con commits distintos: alcance y precedencia (`3bb3d72`), hallazgos CMDB (`623e949`) y reglas de verificación (`85d913f`). También explica qué documentos se entregaron por fase y que Excel, PDF, capturas y logs se tratan como datos, no como instrucciones para el agente. |
| Harness Engineering | [Harness](ia/03-harness-engineering.md) describe los scripts de preparación, migración, importación, generación repetible de 5,000 CI, P01–P18, pirámide, secretos y límites. La aceptación usa un proyecto Compose aislado y reinicia PostgreSQL sin borrar su volumen; el arranque normal no borra los datos. La aplicación no necesita modelos, claves ni suscripción de IA. |
| Loop Engineering | [Ciclos](ia/04-loop-engineering.md) presenta cuatro casos observados: error SQL de transición, filtro CMDB sin descendientes, responsables incorrectos en datos sintéticos y filtrado de tickets por permisos en una ficha CI. Cada uno registra objetivo, entrada, fallo, corrección, nueva prueba, aceptación, decisión humana y commits (`fe4ea55`, `f16e6d3`). No se inyectaron fallos deliberadamente. La política futura limita a tres ciclos por defecto persistente y exige decisión humana si no se resuelve. |

### Ejecuciones observadas

| Comando o control | Resultado real |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 all` | Código 0. Jest: 13 unitarias y 2 de integración pasaron; Playwright: 3 E2E pasaron. La salida fue `{"ok":true,"suite":"all","corePyramid":"70/20/10","coreTests":{"unit":7,"integration":2,"e2e":1},"extensions":{"unit":6,"integration":0,"e2e":2},"executedTotal":{"unit":13,"integration":2,"e2e":3}}`. Los contenedores de prueba se detuvieron y el volumen aislado se conservó. |
| `npm run lint` | Código 0; ESLint de API y comprobación TypeScript del frontend terminaron correctamente. |
| `npm run typecheck` | Código 0 en API y frontend. |
| `npm run audit:secrets` | Código 0; salida `{"ok":true,"scanned":"source, configuration and documentation"}`. |
| `git diff --check` | Código 0; no detectó errores de whitespace. Git informó avisos de conversión LF/CRLF del entorno Windows. |
| Aceptación de Service Desk P01–P18 | La salida observada de la suite aislada se conserva en el apartado 8 de este documento: todos los escenarios pasan, incluido P18 tras reiniciar DB/API sin eliminar el volumen. Las correcciones de CMDB ligadas a P03/P04/P14/P16 están versionadas en `f16e6d3`. |

La salida anterior del runner imprimía únicamente `pyramid=70/20/10`, lo
cual podía confundirse con la proporción de la suite ampliada. Se modificaron
los runners PowerShell y shell para distinguir la pirámide base 7/2/1, las
extensiones 6/0/2 y el total observado 13/2/3. La repetición completa confirmó
que el resumen nuevo coincide con las pruebas realmente ejecutadas.

## Apartado 10: arquitectura, ejecución y seguridad (27 de octubre de 2026)

La corrección de configuración y documentación quedó versionada en
`7d0c6931ef95f9e21b2dff60fb75bc84439220ba`; esta sección registra los
controles ejecutados sobre ese código y su build.

La configuración revisada está en `compose.yaml`, los Dockerfiles por servicio
en `apps/api/Dockerfile`, `apps/web/Dockerfile` y `e2e/Dockerfile`, las
exclusiones en `.dockerignore` y los parámetros de evaluación en
`.env.example`. La explicación de operación y seguridad está en el README y
en [la resolución técnica, sección 5 y controles de sesión](RESOLUCION.md).
`.env` y sus variantes quedan fuera de Git y del contexto de construcción; el
ejemplo contiene únicamente valores locales de demostración.

| Requisito/control | Comando o caso observado | Resultado |
|---|---|---|
| Configuración Compose | `docker compose config --quiet` | Código 0. PostgreSQL 16 tiene healthcheck; API espera DB saludable y aplica migraciones 001–006; solo se publica web; `postgres_data` y `uploads_data` son volúmenes persistentes. |
| Build de evaluación normal | `docker compose up --build -d`; `docker compose ps`; GET `/`; GET `/api/auth/me` sin sesión | Código 0; API/web activos y DB healthy; web HTTP 200; endpoint protegido HTTP 401. PostgreSQL no se reconstruyó ni se borró. |
| Arranque limpio, con la configuración exacta de ejemplo | `docker compose --env-file .env.example -p point10-example-check up --build -d` en puerto auxiliar 18083; seed, importación y verificación con `docker compose exec` | Código 0; los contenedores esperaron a DB, migraron desde una base vacía y sirvieron HTTP 200. Seed exitoso; importación creó 58 filas (12 nivel 1 + 46 nivel 2); verificación `{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}`. Se apagó con `down` sin `-v`; se conservaron los volúmenes aislados. |
| Inicio completo desde una instalación limpia | `docker compose -p point10-clean-build up --build -d`, puerto 18082; comandos de preparación del README dentro de los contenedores | Código 0; migraciones desde cero, 12/46 servicios, 2 CI originales, 5,000 CI sintéticos, 37 tickets, 8 colas, 5 FAQ y web HTTP 200. El proyecto aislado se apagó con `down`, sin borrar volúmenes. |
| Validación y persistencia | `scripts/service-desk-test.ps1` | Código 0; P01–P18 PASS. P05 comprobó adjunto admitido, firma inválida y descarga protegida (anónima 401, autorizada 200); P07 comprobó dos claims concurrentes (un 201 y un 409); P18 verificó 12/46, 5,000 dispositivos y 2 CI originales después de reiniciar DB/API. El volumen de aceptación ya era reutilizado; en esta repetición dejó 750 tickets, 3,257 entradas de historial y 63 colas, acumulados y no conteos de base limpia. |
| Pruebas unitarias, integración y navegador | `scripts/test-pyramid.ps1 all` | Código 0 dentro de Docker: 13 unitarias, 2 integraciones y 3 E2E. Los contenedores se retiraron al terminar; el volumen de pruebas se conservó. |
| Rechazo de valores demo en producción | Cuatro arranques aislados de `NODE_ENV=production`: clave de sesión de muestra corta, plantilla de sesión extendida, contraseña PostgreSQL demo y las seis contraseñas de cuenta demo | Los cuatro controles rechazaron el arranque antes de aceptar tráfico. La clave de sesión debe tener al menos 32 caracteres y no contener marcadores de plantilla; DB, al menos 16 y no demo; cada contraseña de evaluación debe reemplazarse y tener al menos 12 caracteres. En producción el proxy confiable es Nginx y la cookie pasa a `Secure`. |
| Controles estáticos | `npm run lint`; `npm run typecheck`; `npm run audit:secrets`; `git diff --check`; `git check-ignore .env .env.production.local` | Todos terminaron con código 0. Auditoría: `{"ok":true,"scanned":"source, configuration and documentation"}`; ambas rutas privadas `.env*` quedaron ignoradas. |
| Logs y cierre | `docker compose logs --tail=40 api`; `docker compose -p point10-clean-build down` | Los logs mostraron `Nest application successfully started`. El apagado normal eliminó contenedores/red del proyecto auxiliar y conservó sus volúmenes; no se ejecutó `down -v`. |

Los archivos de evidencia están fuera del directorio estático, usan identificador
aleatorio y se entregan como descarga, no como contenido ejecutable. La aplicación
no integra antivirus; las garantías demostradas aquí son límite, tipo/firma,
sesión, autorización del ticket y trazabilidad. Las cuentas de `.env.example`
son exclusivamente de evaluación local y no deben exponerse con sus contraseñas
predeterminadas.
