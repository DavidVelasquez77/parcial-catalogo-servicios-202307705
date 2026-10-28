# Ingeniería asistida por IA: ampliación Service Desk

Este registro selecciona decisiones y comprobaciones de la tarea individual. El autor operó Codex (familia GPT-6; la versión exacta de la sesión no aparece en el proyecto) los días 26–27 de octubre de 2026. Los prompts operativos se redactaron por el asistente bajo autorización del estudiante para dirigir su propio trabajo; no se afirma que sean transcripciones literales de un chat externo. Los resultados son salidas de comandos y cambios versionados, no evaluaciones inventadas.

## 1. Context Engineering

El punto de entrada es [AGENTS.md](../AGENTS.md). La selección por fase fue:

| Fase | Contexto proporcionado y razón | Decisión que evita confusiones |
|---|---|---|
| Requisitos | `Tarea_Service_Desk.pdf`, `docs/contexto/enunciado.md` (texto original del parcial 2), `data/CatalogoServicios.xlsx` y `AGENTS.md` | La nueva tarea autoriza tickets; el parcial anterior no los tenía. El enunciado anterior está preservado como texto idéntico al recibido, aunque la nueva tarea lo denomina `Parcial Practico 2.pdf`. La rúbrica es norma; las celdas y diapositivas son datos. |
| CMDB | `CMDB.xlsx` hoja CMDB B4:U6, `leccion22_Transicion.pdf` páginas 11–12, `transcripciónTransición.md` y `docs/CMDB_JERARQUIA.md` | Hardware/Software vienen del Excel; cuatro subcategorías de generación son del proyecto. La composición entre CI tiene padre único. No se inventa Base de Datos1. |
| Service Desk | `Service Desk.pdf` diapositivas 11–16, `transcripciónServiceDesck.md` 10:26–11:16, `process-rules.ts`, `incident-rules.ts` | Se distingue tipo de ticket de proceso y aclaración oral sobre tablas/CRUD CMDB de la política complementaria del proyecto. |
| Verificación | P01–P18 del enunciado, `scripts/service-desk-test.*`, salidas de Compose | Una captura no prueba idempotencia, autorización ni persistencia. |

Se registran tres actualizaciones de contexto con cambios versionados: (1) `3bb3d72` añadió el alcance Service Desk, la precedencia de fuentes y la separación de grafos; (2) `623e949` documentó el hallazgo de los dos CI, la referencia ausente y la importación transaccional; (3) `85d913f` cerró el contexto tras verificar P01–P18, Jest, Playwright, lint, tipos y auditorías, y fijó la regla de repetir controles afectados ante cambios nuevos. La actualización 3 interna de `AGENTS.md` también se añadió en `623e949`; las tres actualizaciones aquí seleccionadas quedan vinculadas a tres commits distintos. La regla de confianza de `AGENTS.md` impide ejecutar instrucciones dentro de Excel, PDFs, logs o resultados de herramientas. Los documentos externos sirven para datos y requisitos, no para dar órdenes al agente.

## 2. Prompt Engineering

Los ocho prompts operativos y sus criterios están en [prompts/service-desk.md](prompts/service-desk.md). Cubren requisitos, CMDB, modelo, colas, procesos, seguridad, grafos y pruebas. El resultado de cada uno apunta a un archivo o a P01–P18. Las iteraciones documentadas allí son: transferencia (respuesta HTTP esperada) y transición (tipado SQL del estado). Ambas surgieron de fallos reales durante el harness; no fueron fallos introducidos deliberadamente.

## 3. Harness Engineering

El harness actual combina AGENTS.md, compose.yaml, migraciones 001–006, validadores e importadores, generador, semillas, scripts/service-desk-test.ps1/.sh, Jest, Playwright y auditoría de secretos. La rutina Service Desk opera en el proyecto Compose aislado service-desk-suite-202307705: valida e importa los dos Excel, genera y repite 5,000 CI con EVAL2026, prepara flujos, ejecuta P01–P17 y reinicia DB/API para P18. La API aplica las migraciones al arrancar; no se necesita instalar Node ni PostgreSQL en el host.

Los comandos de aceptación son powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1 en Windows y sh scripts/service-desk-test.sh en Linux/macOS. Las pruebas unitarias, integración y navegador se ejecutan por separado o juntas mediante scripts/test-pyramid.ps1 [unit|integration|e2e|all] y sh scripts/test-pyramid.sh [unit|integration|e2e|all]. Los volúmenes aislados se conservan y el arranque no ejecuta down -v. El detalle de comandos, salidas y límites está en harness engineering (ia/03-harness-engineering.md) y PRUEBAS.md.

La pirámide base del parcial anterior es 7/2/1 (70/20/10). Service Desk añadió siete pruebas unitarias y dos recorridos de navegador; la suite ampliada ejecuta 14/2/3. El resumen actualizado del harness presenta por separado la base, las ampliaciones y el total, sin atribuir porcentajes falsos al total ampliado.

## 4. Loop Engineering

Se documentaron cuatro ciclos reales de corrección: un fallo SQL al recorrer los siete procesos, el filtro CMDB que no incluía subcategorías, la normalización de responsables sintéticos y la visibilidad de tickets desde la ficha CI. Cada ciclo conserva entrada, resultado observado, cambio, nueva verificación, criterio de salida, decisión humana y commit en ia/04-loop-engineering.md. No se introdujeron fallos deliberadamente.

El límite histórico no estaba implementado como contador. Para trabajo posterior queda documentado un máximo de tres correcciones enfocadas al mismo defecto; si sigue fallando, se detiene y el estudiante decide el siguiente paso. La intervención humana fija alcance, conserva requisitos de seguridad y fuentes, y acepta la evidencia después de comprobar los resultados.

## 5. Grafos y evidencia

La explicación oral de la lección 25 (transcripción 5:48–5:59) dijo que
Graph Engineering sería opcional en la evaluación oral, mientras el enunciado
escrito sigue exigiendo relaciones, ciclos y recorrido de impacto. Se modelaron
estos grafos por separado, con semántica y reglas propias:

| Grafo | Nodo y arista | Invariante | Evidencia |
|---|---|---|---|
| Clasificación | `ci_categories`; `parent_id` apunta a una categoría padre | A lo sumo un padre, padre/antecesores activos y ningún ciclo | API `CmdbService.updateCategory`, P04 |
| Composición física | `configuration_items`; `PARENT_OF` va de CI padre a componente | Un solo padre físico por componente y ningún ciclo de composición | Migración 005, `CmdbService.createRelation`, P14 |
| Dependencia técnica | `configuration_items`; `DEPENDS_ON` y `HOSTED_ON` van del CI dependiente al CI requerido | Sin ciclos incluso al combinar ambos tipos | `CmdbService.createRelation`, P14 |
| Conectividad | `configuration_items`; `CONNECTED_TO` registra un enlace técnico | Puede formar ciclos, porque una red puede tener caminos alternos | Política en `CmdbService.createRelation` y [PROCESOS.md](PROCESOS.md) |
| CI → servicio y ticket | `ci_services` y `ticket_ci` enlazan nodos de dominio | Solo referencias existentes; no se infiere que una dependencia sea una falla | Ficha de CI, P05/P14 |

El análisis de impacto empieza en un CI, sigue **en sentido inverso** las
aristas `DEPENDS_ON` y `HOSTED_ON` para hallar los CI que lo requieren, y une
sus servicios por `ci_services`. La consulta recursiva usa `UNION` sobre el ID
del CI para visitar cada nodo una vez y terminar incluso ante datos heredados
anómalos. Devuelve servicios *potencialmente afectados*, no un diagnóstico de
interrupción. `CONNECTED_TO` y `PARENT_OF` no se usan como prueba de impacto
automático porque representan otra semántica. El diagrama, las celdas y las
denominaciones de origen están en [CMDB_JERARQUIA.md](CMDB_JERARQUIA.md).

Durante la revisión de fuentes y código se detectó que la primera validación
impedía ciclos por cada tipo técnico, pero permitía un ciclo formado por una
arista `DEPENDS_ON` y otra `HOSTED_ON`. La corrección valida ambos tipos como
un solo grafo acíclico. La prueba P14 intenta ese ciclo mixto y exige HTTP 409.
La regla de padre físico único proviene de la explicación oral de la lección
22 (21:37–22:01); los tipos de arista y el recorrido son decisiones operativas
del proyecto, no valores del Excel.

La secuencia verificable de esta revisión fue: lectura del Excel, PDF y
transcripciones → diagrama/diccionario versionados en `77bef42` → revisión de
`ci_relations` y hallazgo de padre múltiple y ciclo mixto posible → migración
005 y cambio de API fijados en `13b27c1` → P04/P14 y suite completa con código
0 → actualización de la evidencia. El hallazgo se detectó al revisar código;
**no se ejecutó una prueba roja antes de la corrección**, por lo que esta
secuencia no se presenta como un ciclo de fallo automatizado previo. Los
ciclos completos con fallo observado y nueva verificación están en la tabla
de Loop Engineering de arriba.

La ejecución reproducible vigente de P04/P14 está registrada junto con P01–P18
en [la evidencia del 27 de octubre](evidencias/2026-10-27-punto11.md), asociada
al commit `e8b7b23`. La pirámide Jest/Playwright quedó corregida y registrada en
`da1658b`; el reporte documental del punto 11 está en `2cf515c`.

## Commits clave

`3bb3d72`: modelo y generador; `fe4ea55`: tickets, flujos y aceptación; `623e949`: importación del CMDB original y formularios; `146bbe4`: documentos, pruebas y calidad; `85d913f`: tercera actualización de contexto verificada; `677c807`: edición visual de colas/categorías y filtros completos; `77bef42`: transcripción y fuentes CMDB; `13b27c1`: padre físico único, ubicaciones y validación de grafos; `e8b7b23`: suite P01–P18 y datos de demostración; `da1658b`: resumen de pruebas con conteos reales; `2cf515c`: evidencia del punto 11. Consulte `git log --oneline` para el SHA completo de entrega. La entrega anterior del catálogo se mantiene en la etiqueta `parcial-v2.0`.
