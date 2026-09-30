# Registro de prompts utilizados

## Propósito

Estos prompts documentan cómo se dividió el trabajo por riesgo. Cada prompt tuvo contexto, restricciones, resultado esperado y una forma de verificación. No se incluyen conversaciones completas: se conservan instrucciones representativas y verificables.

El propósito de esta carpeta no es demostrar que se escribió mucho texto. Es demostrar que las instrucciones dirigieron decisiones concretas, que esas decisiones se incorporaron al código y que luego se comprobaron con una salida observable.

## Herramienta y fecha

- Herramienta: asistente Codex dentro del entorno de trabajo.
- Modelo disponible: Codex basado en GPT-5; la versión menor exacta del runtime no se expone al repositorio.
- Fecha de ejecución documentada: 30 de septiembre de 2026.
- Repositorio usado: parcial-catalogo-servicios-202307705.
- El proyecto no depende de un modelo para ejecutarse; el modelo solo participó en análisis, diseño, implementación y verificación.

La fecha se registra para que el revisor distinga el contexto disponible durante la construcción. Cuando la plataforma no expone una versión menor del runtime, se declara esa limitación en vez de inventar un identificador.

## Inventario

| Archivo | Pregunta que resuelve | Evidencia |
|---|---|---|
| 01-analisis-excel.md | ¿Qué significa cada fila y dónde están las anomalías? | hoja, rangos y conteos |
| 02-modelo-datos.md | ¿Cómo representar relaciones y restricciones? | migration 001 |
| 03-autenticacion.md | ¿Cómo proteger sesión y roles? | AuthGuard, RolesGuard, smoke |
| 04-importador.md | ¿Cómo lograr una carga repetible? | importador y verify |
| 05-pruebas-docker.md | ¿Cómo demostrar reproducibilidad? | harness y Compose |

## Estructura común de cada prompt

Cada ficha responde las mismas preguntas:

1. **Propósito:** qué riesgo o decisión se quiere resolver.
2. **Contexto suministrado:** qué documentos y hechos se entregaron al asistente.
3. **Instrucción:** la solicitud concreta, separada de los datos del Excel.
4. **Restricciones:** qué no podía hacerse y qué invariantes debían mantenerse.
5. **Salida esperada:** formato o contenido comprobable.
6. **Criterio de aceptación:** cómo se decidió si la respuesta era útil.
7. **Resultado aplicado:** qué archivo, módulo o prueba demuestra que no quedó solo como conversación.

## Relación entre prompts y artefactos

| Prompt | Decisión resultante | Código o documento que la respalda | Control |
|---|---|---|---|
| análisis del Excel | fila física no equivale a servicio | ImportService, IMPORTACION.md | validate-import y verify-import |
| modelo de datos | claves, relaciones y checks | database/migrations/001_init.sql | migración + typecheck |
| autenticación | guards, bcrypt y sesión persistida | auth/, users/, smoke.js | P01–P03 |
| importador | upsert incremental, SE.12 y trazabilidad | imports/import.service.ts | P06–P08 |
| pruebas y Docker | rutina reproducible y límites | harness.mjs, acceptance.js | P01–P12 |

## Forma de evaluar cada prompt

1. Separar el objetivo de la implementación.
2. Incluir restricciones explícitas.
3. Pedir una salida comprobable.
4. Ejecutar el cambio.
5. Comparar la salida con el criterio de aceptación.
6. Registrar la iteración si aparece un hallazgo.

## Iteraciones importantes

### Iteración de importación

- Supuesto inicial: cada fila representa un servicio.
- Hallazgo: las celdas combinadas y filas de continuación rompen ese supuesto.
- Corrección: usar el código de nivel 2 como criterio de creación y recuperar el valor de la celda principal.
- Comprobación: 12 nivel 1, 46 nivel 2, 0 duplicados.

### Iteración de seguridad

- Supuesto inicial: ocultar botones basta para Consulta.
- Hallazgo: un usuario puede invocar la API sin utilizar la interfaz.
- Corrección: guards de servidor más controles visuales.
- Comprobación: POST como Consulta devuelve 403.

### Iteración de runtime

- Supuesto inicial: la ruta local de migraciones era igual dentro del contenedor.
- Hallazgo: el log mostró una ruta inexistente.
- Corrección: alinear el script con la ruta copiada por Dockerfile.
- Comprobación: migración y API arrancan correctamente.

### Iteración de importación incremental

- Supuesto inicial: una reimportación podía ejecutar UPDATE para todos los códigos existentes.
- Hallazgo: actualizar filas idénticas genera ruido, cambia updated_at sin necesidad y no distingue un archivo sin cambios.
- Corrección: comparar campos importables antes de actualizar; contar iguales como skipped.
- Comprobación: una carga repetida conserva 12 niveles 1, 46 niveles 2 y 0 duplicados, y el resumen diferencia updated de skipped.

### Iteración de validación del archivo

- Supuesto inicial: bastaba con comprobar que existiera la hoja.
- Hallazgo: un archivo con encabezados desplazados o umbrales textuales podía llegar a la transacción.
- Corrección: validar encabezados A4:L4, rango de datos, padres, nombres, tipos numéricos y mínimo ≤ máximo antes de crear import_runs.
- Comprobación: validate-import.js devuelve un reporte JSON y termina con error sin modificar servicios cuando encuentra una estructura inválida.

## Criterio de calidad

Un prompt se considera útil cuando produce una decisión que puede señalarse en el código, ejecutarse con un comando y compararse contra una salida observable.

## Qué no se afirma

Estas fichas no pretenden demostrar que el asistente reemplazó el criterio humano. Las decisiones sobre el nombre canónico de SE.12, el tratamiento de ausencias, la no eliminación de códigos ausentes, la arquitectura sin Prisma y la política de responsables fueron revisadas y aceptadas como decisiones del proyecto. El asistente propuso alternativas; el repositorio conserva las reglas elegidas y sus razones.
