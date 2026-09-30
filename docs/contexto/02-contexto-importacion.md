# Contexto 02: actualización por hallazgos del Excel

## 1. Propósito

Este contexto explica cómo se interpretó el workbook real antes de diseñar la importación. La idea central es que una fila física de Excel no equivale necesariamente a un servicio de nivel 2.

## 2. Archivo y hoja de trabajo

| Elemento | Regla |
|---|---|
| Archivo del repositorio | `data/CatalogoServicios.xlsx` |
| Ruta dentro de Docker | `/app/data/CatalogoServicios.xlsx` |
| Hoja obligatoria | `Servicios Externos` |
| Encabezados | fila 4, columnas A:L |
| Primera fila de datos | fila 5 |
| Última fila detectada en el archivo original | fila 101 |
| Servicios identificados | 46 códigos `COD.N2` |
| Filas de continuación | 51 |
| Niveles 1 | 12 códigos distintos |

## 3. Encabezados esperados

El importador valida estos encabezados antes de abrir la transacción:

~~~text
A  COD.N1
B  SERVICIO - NIVEL 1
C  COD.N2
D  SERVICIO - NIVEL 2
E  ACTIVO
F  CLASE DE SERVICIO
G  CRITICIDAD
H  TIPO DE SERVICIO
I  DESCRIPCIÓN
J  MÉTRICA
K  MINIMO
L  MAXIMO
~~~

Los encabezados se comparan normalizando espacios y acentos para detectar diferencias de formato, pero no se cambia el significado de los datos.

## 4. Celdas combinadas y filas de continuación

El archivo utiliza rangos combinados para representar visualmente un nivel 1 o para extender información entre varias filas. Si se toma el valor visible de cada fila sin revisar el rango, se pueden crear servicios falsos.

La regla implementada es:

1. leer la celda master cuando una celda pertenece a un rango combinado;
2. tratar una celda secundaria combinada de `COD.N2` como ausencia de código;
3. crear un servicio solo cuando existe un `COD.N2` explícito;
4. mantener la fila de continuación como información observada, no como servicio;
5. conservar la fila de origen en `source_rows`.

Esto explica por qué el archivo tiene 101 filas de datos físicas, pero solo 46 servicios importables.

## 5. Caso SE.12

El código `SE.12` aparece con nombres de nivel 1 que no son completamente iguales. Crear dos padres con el mismo código rompería la unicidad y dificultaría las relaciones.

La decisión es:

- conservar como nombre canónico el de la primera ocurrencia;
- mantener un solo registro de nivel 1;
- registrar el nombre alternativo como observación `WARNING`;
- importar sus servicios de nivel 2 como códigos distintos;
- conservar campos faltantes como `NULL`;
- marcar `SE.12.1`, `SE.12.2` y `SE.12.3` como `REVIEW` cuando corresponda.

Esta es una decisión de normalización documentada, no una corrección silenciosa del Excel.

## 6. Validación antes de modificar la base

`validateFile()` revisa:

1. existencia y lectura del archivo XLSX;
2. existencia de la hoja obligatoria;
3. encabezados A4:L4;
4. bloque de datos localizado dinámicamente;
5. padre y nombre de cada `COD.N2`;
6. tipos de `ACTIVO`, `MINIMO` y `MAXIMO`;
7. relación `MINIMO <= MAXIMO`;
8. presencia de al menos un servicio;
9. códigos repetidos como advertencias.

Si existe un error estructural, el proceso termina con código distinto de cero y no crea `import_runs`, no actualiza servicios y no modifica catálogos.

## 7. Sincronización incremental

El código `COD.N2` es la identidad funcional del servicio:

| Situación del nuevo Excel | Acción |
|---|---|
| código no existente | insertar |
| código existente con campos diferentes | actualizar solo ese registro |
| código existente sin cambios | omitir y contar como `skipped` |
| código repetido dentro del mismo archivo | conservar primera ocurrencia y observar |
| código ausente en el nuevo archivo | conservar en la base; no borrar automáticamente |

Los campos importables se comparan antes del `UPDATE`. Las asignaciones de sección y usuario responsable no se reemplazan con valores vacíos provenientes del Excel.

## 8. Campos incompletos

Las filas 99–101 contienen información incompleta. La política es:

- vacío textual → `NULL`;
- catálogo desconocido → FK `NULL` y observación;
- servicio existente pero incompleto → `REVIEW`;
- mínimo o máximo ausente → conservar `NULL`;
- no inventar descripción, métrica, clase, criticidad o tipo.

## 9. Trazabilidad

Cada servicio importado conserva:

- `source_sheet`;
- `source_rows`;
- `source_transformations`.

Cada ejecución conserva sus contadores en `import_runs`. Las incidencias específicas se guardan en `import_observations` con severidad, código, mensaje, hoja y fila.

## 10. Criterios de aceptación

El contexto de importación se considera correctamente aplicado cuando:

- `validate-import.js` devuelve hoja y rango correctos;
- el archivo original produce 12 niveles 1 y 46 niveles 2;
- `verify-import.js` confirma 0 duplicados y 3 servicios en revisión;
- una segunda importación idéntica no genera actualizaciones innecesarias;
- un cambio de Excel actualiza el código correspondiente;
- un código nuevo se agrega;
- un archivo inválido se detiene antes de tocar la base.
