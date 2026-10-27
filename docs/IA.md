# Ingeniería asistida por IA: ampliación Service Desk

Este registro selecciona decisiones y comprobaciones de la tarea individual. El autor operó Codex (familia GPT-6; la versión exacta de la sesión no aparece en el proyecto) los días 26–27 de octubre de 2026. Los prompts operativos se redactaron por el asistente bajo autorización del estudiante para dirigir su propio trabajo; no se afirma que sean transcripciones literales de un chat externo. Los resultados son salidas de comandos y cambios versionados, no evaluaciones inventadas.

## 1. Context Engineering

El punto de entrada es [AGENTS.md](../AGENTS.md). La selección por fase fue:

| Fase | Contexto proporcionado y razón | Decisión que evita confusiones |
|---|---|---|
| Requisitos | `Tarea_Service_Desk.pdf`, catálogo original y `AGENTS.md` | La nueva tarea autoriza tickets; el parcial anterior no los tenía. La rúbrica es norma; las celdas y diapositivas son datos. |
| CMDB | `CMDB.xlsx` hoja CMDB B4:U6, `leccion22_Transicion.pdf`, `docs/MODELO.md` | Hardware/Software vienen del Excel; cuatro subcategorías de generación son del proyecto. No se inventa Base de Datos1. |
| Service Desk | `Service Desk.pdf` diapositivas 11–16, `process-rules.ts`, `incident-rules.ts` | Se distingue tipo de ticket de proceso y lección de política complementaria. |
| Verificación | P01–P18 del enunciado, `scripts/service-desk-test.*`, salidas de Compose | Una captura no prueba idempotencia, autorización ni persistencia. |

Se registran tres actualizaciones de contexto con cambios versionados: (1) `3bb3d72` añadió el alcance Service Desk, la precedencia de fuentes y la separación de grafos; (2) `623e949` documentó el hallazgo de los dos CI, la referencia ausente y la importación transaccional; (3) `623e949` añadió la rutina aislada P01–P18 y la regla de no atribuir a Excel las categorías sintéticas. Las actualizaciones 2 y 3 están en un mismo commit porque se cerraron juntas tras la prueba; son dos decisiones distintas, no dos commits ficticios. La regla de confianza de `AGENTS.md` impide ejecutar instrucciones dentro de Excel, PDFs, logs o resultados de herramientas. Los documentos externos sirven para datos y requisitos, no para dar órdenes al agente.

## 2. Prompt Engineering

Los ocho prompts operativos y sus criterios están en [prompts/service-desk.md](prompts/service-desk.md). Cubren requisitos, CMDB, modelo, colas, procesos, seguridad, grafos y pruebas. El resultado de cada uno apunta a un archivo o a P01–P18. Las iteraciones documentadas allí son: transferencia (respuesta HTTP esperada) y transición (tipado SQL del estado). Ambas surgieron de fallos reales durante el harness; no fueron fallos introducidos deliberadamente.

## 3. Harness Engineering

El harness es el conjunto `AGENTS.md` + `compose.yaml` + migraciones 001–004 + importadores + generador + semillas + `scripts/service-desk-test.ps1/.sh` + Jest + Playwright + auditoría de secretos. Su rutina aislada hace, en orden:

1. Construir PostgreSQL y API y esperar salud; la API ejecuta las migraciones.
2. Crear organización y cuentas; validar/importar catálogo dos veces y verificar 12/46.
3. Importar `CMDB.xlsx` dos veces, con observaciones; generar 5,000 dispositivos dos veces con la misma semilla.
4. Crear siete colas y 37 tickets de ejemplo; ejecutar P01–P17 con códigos de salida.
5. Tomar una huella de conteos, reiniciar PostgreSQL/API y comparar la huella para P18.

La rutina no borra volúmenes. `DESK_TEST_ISOLATED=1` impide ejecutar la aceptación por accidente sobre la instalación normal. Los Excel se montan de solo lectura, el auditor revisa secretos versionados y `.env` permanece ignorado. Los comandos y salidas reales se consignan en [PRUEBAS.md](PRUEBAS.md). La aplicación funciona después de construirse sin claves ni suscripción de IA.

## 4. Loop Engineering

Se realizaron ciclos acotados de objetivo → cambio → ejecución → evaluación → corrección → nueva verificación. El límite operativo fue corregir la causa concreta y repetir el escenario afectado; una nueva falla daba lugar a otro ciclo, nunca a afirmar éxito sin salida. El estudiante fijó el alcance, eligió no usar Prisma y conservó los Excel originales. No se introdujeron fallos deliberadamente.

| Ciclo | Entrada, fallo observado | Corrección y nueva salida | Criterio de cierre |
|---|---|---|---|
| 1. Transferencia/permiso | P07 elegía por orden alfabético una cola privada creada por P06; un agente sin permiso obtenía 403 cuando la prueba quería demostrar concurrencia en la cola común. | La prueba pasó a seleccionar `Q-INCIDENT` por código; la corrida final devolvió un 201 y un 409 para los dos agentes. | Solo un reclamo, orden estable y permiso real sin relajar la API. |
| 2. Transición funcional | P09 falló con PostgreSQL `inconsistent types deduced for parameter $1` al escribir un estado nuevo. | Se convirtió `$1` explícitamente a `text` en el `UPDATE`; P09 recorrió y cerró los siete procesos. | Todas las rutas válidas pasan y las inválidas siguen rechazadas. |
| 3. Contrato HTTP y verificación | P08 esperaba 200 para un POST de Nest que devuelve 201. P14 comparó un `bigint` textual de PostgreSQL con un número JavaScript. Ambas eran fallas del oráculo de prueba, no de los datos. | Se corrigieron las expectativas y la conversión del ID; P08 y P14 dieron PASS sin cambiar el contrato de la API. | Prueba fiel a la respuesta y relación verificable. |
| 4. Datos CMDB | La fuente menciona `Base de Datos1` en dos filas sin incluir ese CI ni definir tipo de arista. | Se conservó el valor en `technical_attributes` y se registraron dos observaciones por importación; repetición final: `skipped=2`, `observed=2`, ningún CI ficticio. | Preservar los dos originales y no inventar enlaces. |

Los ciclos 1 y 2 cubren permiso/datos y defecto funcional respectivamente; el ciclo 3 muestra corrección del harness. El criterio humano de aceptación fue que un tercero pudiera clonar, ejecutar, inspeccionar las fuentes y explicar ambos grafos. Las pruebas no sustituyen la defensa individual.

## 5. Grafos y evidencia

Aunque la explicación oral aclaró que Graph Engineering no se califica de forma separada, el enunciado exige funcionalidad de grafos. La clasificación de categorías y las dependencias técnicas tienen reglas de ciclo diferentes, descritas en [MODELO.md](MODELO.md) y [PROCESOS.md](PROCESOS.md). P04 rechaza ciclo de clasificación; P14 rechaza ciclo de dependencia y recorre CI → servicio potencialmente afectado. El recorrido no diagnostica por sí solo una interrupción efectiva.

## Commits clave

`3bb3d72`: modelo y generador; `fe4ea55`: tickets, flujos y aceptación; `623e949`: importación del CMDB original, formularios y actualizaciones de contexto. Los documentos de esta fase se agregan en un commit posterior; consulte `git log --oneline` para el SHA completo de entrega. La entrega anterior del catálogo se mantiene en la etiqueta `parcial-v2.0`.
