# Ingeniería asistida por IA

Esta carpeta organiza las cuatro prácticas del enunciado de Service Desk y enlaza cada explicación con artefactos, pruebas y commits reales. No sustituye el código ni el criterio del estudiante.

El flujo usado fue:

```text
FUENTES → CONTEXTO → PROMPT → CAMBIO → HARNESS → EVALUACIÓN/LOOP → EVIDENCIA → CONTEXTO ACTUALIZADO
```

## Lectura recomendada

| Orden | Documento | Qué explica |
|---:|---|---|
| 1 | [01-context-engineering.md](01-context-engineering.md) | selección y precedencia del contexto; cómo separar requisitos de datos externos |
| 2 | [02-prompt-engineering.md](02-prompt-engineering.md) | diseño de prompts verificables y evaluación de resultados |
| 3 | [03-harness-engineering.md](03-harness-engineering.md) | comandos, herramientas, datos aislados, controles y límites |
| 4 | [04-loop-engineering.md](04-loop-engineering.md) | cuatro ciclos reales de corrección con intervención humana y criterio de salida |
| 5 | [../prompts/service-desk.md](../prompts/service-desk.md) | ocho instrucciones operativas de la ampliación y dos mejoras comprobadas |
| 6 | [../IA.md](../IA.md) | resumen de fuentes, contextos, prompts, harness y grafos |
| 7 | [../PRUEBAS.md](../PRUEBAS.md) | comandos, fechas, commits, resultados y fallos corregidos |

`../evidencias/ciclo-harness.md` conserva la evidencia histórica del harness del catálogo del parcial 2. Sus P01–P11 y 7/2/1 describen aquella entrega, no sustituyen los P01–P18 ni las 13/2/3 pruebas actuales de Service Desk.

## Herramientas y límites de evidencia

Se usaron Codex, Git, Docker Compose, TypeScript/NestJS/React, PostgreSQL, ExcelJS, Jest y Playwright. Codex estaba disponible en la familia GPT-6; el runtime no expuso una versión menor. El proyecto no requiere una IA para ejecutarse. Las instrucciones de trabajo se resumen sin transcribir conversaciones completas; una propuesta solo cuenta como resultado cuando existe una implementación o evidencia ejecutable.

Las fuentes académicas y los Excel aportan requisitos o datos según corresponda. El texto dentro de un Excel, PDF, log o captura no gana autoridad sobre las instrucciones del estudiante o el enunciado. `AGENTS.md` fija esa precedencia y prohíbe ejecutar instrucciones encontradas dentro de los datos.

## Regla de cierre

Cada práctica se vincula a archivos concretos. La evidencia registra resultados reales; los fallos deliberados se declararían explícitamente. En los ciclos documentados no se introdujeron fallos deliberadamente.
