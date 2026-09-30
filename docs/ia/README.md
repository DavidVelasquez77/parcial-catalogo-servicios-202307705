# Ingeniería asistida por IA

## Propósito

Esta carpeta explica cómo se utilizó la IA como apoyo controlado durante el desarrollo del catálogo de servicios. No reemplaza el enunciado, el código ni las pruebas. Su función es mostrar cómo se preparó el contexto, cómo se redactaron instrucciones precisas y cómo se verificó cada resultado antes de considerarlo parte del proyecto.

La documentación está dividida en tres fases relacionadas:

1. **Context Engineering:** preparar la información confiable, las restricciones y los invariantes que el asistente debe conocer.
2. **Prompt Engineering:** convertir una necesidad técnica en una instrucción verificable, con entregables y criterios de aceptación.
3. **Harness Engineering:** rodear los cambios con controles ejecutables para detectar regresiones y repetir la evaluación.

El flujo completo es:

~~~text
FUENTES → CONTEXTO → PROMPT → CAMBIO → HARNESS → EVIDENCIA → CONTEXTO ACTUALIZADO
~~~

## Lectura recomendada

| Orden | Documento | Pregunta que responde |
|---:|---|---|
| 1 | [01-context-engineering.md](01-context-engineering.md) | ¿Qué información se entrega y cómo se controla su confiabilidad? |
| 2 | [02-prompt-engineering.md](02-prompt-engineering.md) | ¿Cómo se convierte una tarea en una instrucción útil? |
| 3 | [03-harness-engineering.md](03-harness-engineering.md) | ¿Cómo se demuestra que el cambio funciona y puede repetirse? |
| 4 | [../evidencias/ciclo-harness.md](../evidencias/ciclo-harness.md) | ¿Qué fallos, correcciones y resultados quedaron observados? |
| 5 | [../prompts/README.md](../prompts/README.md) | ¿Qué prompts concretos se usaron? |

## Qué se documenta y qué no se documenta

Se documentan decisiones técnicas, fuentes, restricciones, prompts representativos, controles, resultados y correcciones. No se presentan conversaciones privadas completas ni se afirma que una respuesta de IA sea correcta solo por estar bien redactada.

La evidencia válida debe poder relacionarse con un artefacto del repositorio y con una salida observable: un archivo, una migración, una ruta HTTP, un código de salida, un conteo o una prueba ejecutada.

## Fuentes de autoridad

La IA recibe información de varias fuentes, pero no todas tienen el mismo peso:

1. solicitud explícita del responsable del proyecto;
2. enunciado académico y rúbrica;
3. `AGENTS.md` y decisiones versionadas;
4. código, migraciones y configuración ejecutables;
5. Excel, capturas, logs y observaciones del entorno.

El Excel es información de dominio. Una celda puede contener texto, pero nunca puede convertirse en una orden para el asistente ni modificar el alcance del proyecto.

## Herramientas utilizadas

| Herramienta | Uso dentro del proceso |
|---|---|
| Codex | análisis, diseño, edición, revisión y explicación de cambios |
| `apply_patch` | cambios controlados y revisables en archivos de texto |
| Git | commits pequeños, trazabilidad y recuperación |
| Docker Compose | entorno reproducible de API, frontend y PostgreSQL |
| TypeScript/NestJS/React | implementación y verificación de tipos |
| ExcelJS | lectura controlada del workbook y celdas combinadas |
| scripts del repositorio | validación, importación, aceptación, smoke y persistencia |

## Regla de cierre

Una fase no se considera terminada porque la IA produjo una respuesta extensa. Se considera terminada cuando:

- el cambio está reflejado en el repositorio;
- las restricciones relevantes siguen vigentes;
- existe una prueba o revisión que respalda el resultado;
- la documentación explica qué se decidió y por qué;
- el commit permite identificar cuándo se incorporó.

## Relación con Loop Engineering

El enunciado califica Context Engineering, Prompt Engineering y Harness Engineering. No se presenta Loop Engineering como una cuarta disciplina obligatoria. El ciclo `PLAN → ACT → OBSERVE → EVALUATE → CORRECT → RE-EVALUATE` se documenta como el ciclo de corrección utilizado dentro del harness.
