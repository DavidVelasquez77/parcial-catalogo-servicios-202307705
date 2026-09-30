# Importación y calidad de datos

## Propósito

Este documento explica cómo se transforma data/CatalogoServicios.xlsx en registros de PostgreSQL, qué decisiones se toman ante información ambigua, cómo se valida un Excel nuevo y cómo se verifica que la sincronización sea repetible.

El archivo de entrada se conserva en `data/CatalogoServicios.xlsx` y se monta en el contenedor API como solo lectura. Actualmente contiene la línea base del parcial más cinco niveles 1 y cinco servicios nivel 2 adicionales.

## Archivo de entrada

- Archivo configurado: /app/data/CatalogoServicios.xlsx
- Archivo del repositorio: data/CatalogoServicios.xlsx
- Hoja procesada: Servicios Externos
- Encabezados: A4:L4
- Bloque principal del archivo ampliado actual: filas 5 a 106
- Listas de referencia: E112:H122
- Resultado esperado actual: 17 códigos de nivel 1 y 51 códigos de nivel 2

El archivo inicial del parcial tenía 12 niveles 1 y 46 niveles 2. El archivo actual conserva esos registros y agrega `SE.13` a `SE.17`, cada uno con un servicio nivel 2.

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

## Validación previa obligatoria

Antes de abrir una transacción de importación se ejecuta validateFile. Esta etapa solo lee el workbook; no crea import_runs, no modifica servicios y no cambia catálogos.

Se valida:

1. que el archivo exista y sea un .xlsx legible;
2. que exista la hoja Servicios Externos;
3. que la fila 4 contenga A:L con los encabezados esperados;
4. que exista un bloque de datos después de la fila 4;
5. que cada COD.N2 tenga nombre y un COD.N1 padre;
6. que Minimo y Maximo sean numéricos cuando están presentes;
7. que ningún mínimo sea mayor que su máximo;
8. que existan códigos de nivel 2 para poder importar.

Los códigos repetidos dentro del archivo se reportan como advertencia y la primera aparición es la que se conserva. Las etiquetas de catálogos desconocidas no destruyen la importación: se registran como observaciones y se almacenan como NULL en la FK controlada.

Si falla una regla estructural, el comando termina con código distinto de cero y devuelve los errores y el rango detectado. La base no recibe cambios de catálogo ni de servicios.

## Importación repetible e incremental

El importador usa el código de servicio como identificador estable:

- primera ejecución: crea los registros que no existen;
- segunda ejecución sin cambios: cuenta los registros iguales como skipped y no ejecuta actualizaciones innecesarias;
- ejecución con cambios: actualiza únicamente los códigos cuyo nombre, estado, clasificación, descripción, métrica, umbrales u origen cambió;
- código nuevo: se agrega como un nuevo servicio;
- código ausente en el nuevo Excel: no se elimina ni se desactiva automáticamente;
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

## Reemplazar el Excel de forma segura

El archivo de origen está montado como solo lectura dentro del contenedor. Para evaluar una nueva versión:

1. conservar una copia de respaldo fuera del repositorio;
2. reemplazar data/CatalogoServicios.xlsx por el nuevo .xlsx, manteniendo exactamente ese nombre;
3. reconstruir la API para que el archivo quede incluido en la imagen o volver a levantar el volumen montado;
4. ejecutar la validación y revisar su salida;
5. ejecutar la importación solo si la validación terminó con ok: true;
6. ejecutar verify-import.js y revisar el historial de Importaciones.

En PowerShell:

~~~powershell
Copy-Item -LiteralPath 'C:\ruta\nuevo-catalogo.xlsx' -Destination '.\data\CatalogoServicios.xlsx' -Force
docker compose up --build -d api
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

No se debe editar el Excel dentro del contenedor ni cambiar el nombre del archivo sin actualizar IMPORT_FILE y el volumen de Compose. El sistema no borra servicios que ya estaban en la base y no aparecen en una nueva versión; esa decisión evita bajas destructivas por un archivo incompleto.

## Comandos

~~~bash
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

Resultado esperado de validate-import.js:

~~~json
{"ok":true,"file":"/app/data/CatalogoServicios.xlsx","sheet":"Servicios Externos","dataStartRow":5,"dataEndRow":106,"serviceRows":51,"continuationRows":51,"warnings":[]}
~~~

Resultado esperado de verify-import.js:

~~~json
{"ok":true,"level1":17,"level2":51,"duplicates":0,"review":3,"expected":{"level1":17,"level2":51,"review":3}}
~~~

## Qué significa cada contador

- created: servicios insertados por primera vez.
- updated: servicios que ya existían y fueron sincronizados.
- skipped: servicios o filas que no requieren una escritura, por ejemplo filas de continuación, códigos repetidos del mismo bloque o servicios que ya tienen exactamente los mismos datos.
- observed: incidencias o transformaciones que requieren trazabilidad.

En una primera ejecución observada se obtuvo:

~~~json
{"runId":1,"created":58,"updated":0,"skipped":49,"observed":5,"level1":12,"level2":46}
~~~

En una ejecución repetida de la primera implementación se obtuvo:

~~~json
{"runId":3,"created":0,"updated":46,"skipped":49,"observed":5,"level1":12,"level2":46}
~~~

Ese resultado es histórico: aquella versión actualizaba todos los servicios existentes aunque no hubieran cambiado. La implementación actual compara los campos importables antes de escribir. En una ejecución idéntica posterior se obtuvo:

~~~json
{"runId":24,"created":0,"updated":0,"skipped":46,"observed":5,"level1":12,"level2":46,"validation":{"serviceRows":46,"continuationRows":51,"warnings":[]}}
~~~

Por tanto, si el Excel cambia, solo se actualizan los códigos modificados; si no cambia, se ignoran los 51 servicios; y si aparecen códigos nuevos, se crean. Los controles level1, level2 y duplicates son los invariantes importantes.

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
