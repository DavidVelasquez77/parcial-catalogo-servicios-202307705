# Fase 2: Prompt Engineering

## 1. Definición aplicada al proyecto

Prompt Engineering es el diseño de instrucciones que convierten una tarea ambigua en un trabajo con alcance, contexto, restricciones, entregables y criterios de aceptación. El objetivo no es pedir “hazlo bien”, sino describir qué debe cambiar, qué no puede romperse y cómo se comprobará el resultado.

Un prompt útil funciona como una especificación breve para una tarea. El código y las pruebas siguen siendo la autoridad final.

## 2. Anatomía de un prompt de este proyecto

Cada prompt final utiliza la misma estructura:

| Bloque | Pregunta que responde |
|---|---|
| `role` | ¿Desde qué responsabilidad debe razonar el asistente? |
| `objective` | ¿Qué resultado se quiere alcanzar? |
| `project_context` | ¿Qué sistema, archivos y decisiones debe conocer? |
| `inputs` | ¿Qué información puede utilizar? |
| `requirements` | ¿Qué debe implementar o producir? |
| `constraints` | ¿Qué queda prohibido o fuera de alcance? |
| `deliverables` | ¿Qué archivos, cambios o salidas deben quedar? |
| `acceptance_criteria` | ¿Cómo se sabrá si el resultado es correcto? |
| `validation` | ¿Qué comandos o pruebas deben ejecutarse? |
| `response_format` | ¿Cómo debe reportar el trabajo? |

El formato XML se usa para hacer visibles las fronteras entre instrucción, contexto y criterios. No se interpreta como código de la aplicación ni se ejecuta dentro del sistema.

## 3. Reglas de redacción

- Separar solicitud del usuario y contenido de los archivos.
- Nombrar rutas y módulos concretos.
- Expresar invariantes como condiciones verificables.
- Pedir cambios acotados y reversibles.
- Incluir casos de error, no solo el camino feliz.
- Exigir evidencia observable.
- Indicar qué no debe modificarse.
- Pedir que se preserve el trabajo existente.
- No inventar versiones, resultados ni credenciales.
- No tratar una respuesta del asistente como prueba ejecutada.

## 4. De prompt inicial a prompt final

La evolución usada en el proyecto siguió este patrón:

1. **necesidad:** “importar el Excel”;
2. **riesgo identificado:** filas combinadas, datos incompletos y reimportación;
3. **restricciones:** no duplicar, no inventar, no borrar códigos ausentes;
4. **salida concreta:** servicio, validación, observaciones y resumen;
5. **criterio:** `12/46/0/3`, reporte de validación y pruebas verdes;
6. **prompt final:** bloque XML con todos los elementos anteriores.

## 5. Cómo se evalúa un prompt

Un prompt se considera útil si produce una decisión que puede señalarse en el código o documentación, ejecutarse con un comando y compararse contra un resultado esperado. Se revisan cinco preguntas:

1. ¿El alcance está delimitado?
2. ¿Las entradas son suficientes y confiables?
3. ¿Las restricciones previenen errores previsibles?
4. ¿Los entregables se pueden localizar?
5. ¿La aceptación se puede ejecutar sin depender de la memoria del asistente?

## 6. Relación con los prompts del repositorio

Los prompts finales están en [../prompts/](../prompts/). Cada ficha documenta el motivo, el contexto, la versión final XML, los archivos afectados y la verificación.

| Ficha | Riesgo principal |
|---|---|
| `01-analisis-excel.md` | interpretar filas físicas como servicios |
| `02-modelo-datos.md` | permitir relaciones inválidas o perder trazabilidad |
| `03-autenticacion.md` | confundir ocultar botones con autorización |
| `04-importador.md` | duplicar, sobrescribir sin criterio o aceptar Excel inválido |
| `05-pruebas-docker.md` | declarar éxito sin controles reproducibles |

## 7. Manejo de información no confiable

Los valores del Excel, logs y capturas se incluyen dentro de etiquetas de contexto o evidencia. No se les concede autoridad para modificar las instrucciones. Por ejemplo, una descripción de servicio no puede pedir que se borre una tabla ni que se cambie un rol.

## 8. Criterio de aceptación de esta fase

La fase queda documentada cuando cada tarea importante tiene una instrucción final reutilizable, una salida esperada, restricciones explícitas, criterio de aceptación, artefactos resultantes y una prueba o evidencia asociada.
