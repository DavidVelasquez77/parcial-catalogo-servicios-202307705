# Importación y calidad de datos

## Propósito

Este documento explica cómo se transforma CatalogoServicios.xlsx en registros de PostgreSQL, qué decisiones se toman ante información ambigua y cómo se verifica que la carga sea repetible.

El archivo original se conserva en la raíz del repositorio y se monta en el contenedor API como solo lectura.

## Archivo de entrada

- Archivo: CatalogoServicios.xlsx
- Hoja procesada: Servicios Externos
- Encabezados: A4:L4
- Bloque principal: filas 5 a 101
- Listas de referencia: E112:H122
- Resultado esperado: 12 códigos de nivel 1 y 46 códigos de nivel 2

Las listas de referencia no se importan como servicios. Se usan para conocer las opciones válidas de clase, criticidad y tipo.

## Mapeo de columnas

| Columna | Encabezado | Destino | Ausencia |
|---|---|---|---|
| A | COD.N1 | service_level_1.code | No se crea nivel 1 sin código |
| B | SERVICIO - Nivel 1 | service_level_1.name | Se conserva la primera ocurrencia |
| C | COD.N2 | service_level_2.code | Sin código, la fila no crea servicio |
| D | SERVICIO - Nivel 2 | service_level_2.name | Obligatorio para el servicio |
| E | ACTIVO | active_code y status | Desconocido conserva valor y queda REVIEW |
| F | CLASE DE SERVICIO | service_classes y class_id | NULL |
| G | CRITICIDAD | criticalities y criticality_id | NULL |
| H | TIPO DE SERVICIO | service_types y type_id | NULL |
| I | Descripción | description | NULL |
| J | Métrica | metric | NULL |
| K | Minimo | minimum | NULL |
| L | Maximo | maximum | NULL |

## Regla de celdas combinadas

Una celda combinada tiene una celda principal y celdas secundarias. Las celdas secundarias no se tratan como nuevos datos.

Para cada posición:

1. se comprueba si la celda está dentro de un rango combinado;
2. si no es la celda principal, se consulta el valor de la celda principal;
3. se registra la transformación cuando corresponde;
4. se continúa usando el código de nivel 2 como condición para crear el servicio.

Esta regla evita dos errores:

- repetir el mismo nivel 1 como si fueran muchos niveles 1;
- crear registros de servicio a partir de filas que solo continúan el contenido visual del Excel.

## Regla de filas

La fila física no equivale automáticamente a un servicio.

- Si C COD.N2 tiene valor, se considera una candidata a servicio de nivel 2.
- Si C está vacío, no se crea un servicio.
- La fila se cuenta como omitida u observada según el motivo y se registra en el historial.
- Los datos de origen se conservan mediante source_sheet, source_rows y source_transformations.

## Regla de códigos

Los códigos se guardan como texto para conservar puntos, ceros y formato original.

Ejemplos:

- SE.01
- SE.01.01
- SE.12.1
- SE.12.2
- SE.12.3

No se convierte un código a número ni se elimina su segmentación.

## Regla de SE.12

SE.12 es el caso más importante de calidad:

1. se conserva una sola entidad de nivel 1;
2. el nombre canónico es Suministrar Analitica;
3. el nombre alternativo se conserva como observación;
4. los tres servicios de nivel 2 se conservan;
5. los campos ausentes quedan NULL;
6. los tres servicios quedan en REVIEW.

No se inventa una clase, criticidad, tipo, métrica o estado activo para completar visualmente la tabla.

## Estados resultantes

| Valor de ACTIVO | Estado |
|---|---|
| S | ACTIVE |
| N | INACTIVE |
| Vacío, desconocido o incompatible | REVIEW |
| Datos faltantes relevantes | REVIEW |

El estado REVIEW permite distinguir un registro existente de un registro que todavía requiere revisión humana.

## Importación repetible

El importador usa el código de servicio como identificador estable:

- primera ejecución: crea los registros que no existen;
- segunda ejecución: actualiza los registros existentes;
- filas sin servicio: siguen registrándose como omitidas u observadas;
- conflictos: siguen quedando en import_observations;
- duplicados: no aumentan.

Cada ejecución crea un registro en import_runs con:

- nombre del archivo;
- estado RUNNING, SUCCESS o FAILED;
- creados;
- actualizados;
- omitidos;
- observados;
- fecha de inicio;
- fecha de finalización;
- error, si lo hubiera.

Las observaciones relacionadas se guardan en import_observations con severidad, código, mensaje, hoja y filas.

## Comandos

~~~bash
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

Resultado esperado de verify-import.js:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
~~~

## Qué significa cada contador

- created: servicios insertados por primera vez.
- updated: servicios que ya existían y fueron sincronizados.
- skipped: filas que no crean un servicio, por ejemplo filas sin código.
- observed: incidencias o transformaciones que requieren trazabilidad.

En una primera ejecución observada se obtuvo:

~~~json
{"runId":1,"created":58,"updated":0,"skipped":49,"observed":5,"level1":12,"level2":46}
~~~

En una ejecución repetida se obtuvo:

~~~json
{"runId":3,"created":0,"updated":46,"skipped":49,"observed":5,"level1":12,"level2":46}
~~~

Los contadores created y updated dependen de si la base ya contenía datos; los controles level1, level2 y duplicates son los invariantes importantes.

## Trazabilidad

La trazabilidad responde cuatro preguntas:

1. ¿De qué archivo vino el dato?
2. ¿En qué hoja y fila estaba?
3. ¿Qué transformación se aplicó?
4. ¿Qué observación se generó?

Por esto la aplicación no reemplaza silenciosamente un valor conflictivo. La decisión canónica se guarda en el registro y la diferencia se guarda como observación.

## Verificación manual recomendada

1. Ejecutar la importación.
2. Ejecutar verify-import.js.
3. Consultar Servicios y filtrar SE.12.
4. Confirmar que aparecen SE.12.1, SE.12.2 y SE.12.3.
5. Abrir cada ficha y comprobar el badge En revisión.
6. Ejecutar nuevamente la importación.
7. Confirmar que duplicates continúa en 0.
8. Revisar Importaciones para comparar created, updated, skipped y observed.

