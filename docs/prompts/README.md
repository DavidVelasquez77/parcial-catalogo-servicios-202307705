# Registro de prompts utilizados

## Propósito

Estos prompts documentan cómo se dividió el trabajo por riesgo. Cada prompt tuvo contexto, restricciones, resultado esperado y una forma de verificación. No se incluyen conversaciones completas: se conservan instrucciones representativas y verificables.

## Herramienta y fecha

- Herramienta: asistente Codex dentro del entorno de trabajo.
- Fecha de ejecución documentada: septiembre de 2026.
- Repositorio usado: parcial-catalogo-servicios-202307705.
- Modelo exacto: depende de la configuración del entorno de Codex; el proyecto no depende de un modelo para ejecutarse.

## Inventario

| Archivo | Pregunta que resuelve | Evidencia |
|---|---|---|
| 01-analisis-excel.md | ¿Qué significa cada fila y dónde están las anomalías? | hoja, rangos y conteos |
| 02-modelo-datos.md | ¿Cómo representar relaciones y restricciones? | migration 001 |
| 03-autenticacion.md | ¿Cómo proteger sesión y roles? | AuthGuard, RolesGuard, smoke |
| 04-importador.md | ¿Cómo lograr una carga repetible? | importador y verify |
| 05-pruebas-docker.md | ¿Cómo demostrar reproducibilidad? | harness y Compose |

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

## Criterio de calidad

Un prompt se considera útil cuando produce una decisión que puede señalarse en el código, ejecutarse con un comando y compararse contra una salida observable.

