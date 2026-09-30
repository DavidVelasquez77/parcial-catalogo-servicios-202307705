# Prompt 04: importador repetible

## Propósito

Construir una carga que respete el Excel real y pueda ejecutarse más de una vez.

## Contexto suministrado

- Hoja Servicios Externos.
- Celdas combinadas.
- Filas de continuación.
- Conflicto de SE.12.
- Campos incompletos en SE.12.1, SE.12.2 y SE.12.3.
- Controles obligatorios: 12 niveles 1, 46 niveles 2 y 0 duplicados.
- Archivo original intocable.

## Prompt utilizado

~~~text
Implementa un importador para la hoja Servicios Externos usando una regla explícita para celdas combinadas. Debe conservar 12 códigos de nivel 1 y 46 códigos de nivel 2, tratar SE.12 con nombre canónico por primera ocurrencia, conservar valores alternativos como observación, mantener ausencias como NULL y emitir creados, actualizados, omitidos y observados. La ejecución repetida no puede duplicar. Guarda hoja, fila y transformación de origen.
~~~

## Restricciones

- No crear un registro por cada fila.
- No convertir vacío en cero.
- No corregir el Excel.
- No crear otro nivel 1 para SE.12.
- No duplicar por código.
- Usar transacción.

## Salida esperada

- importador ejecutable dentro del contenedor;
- historial de ejecución;
- observaciones;
- verificador de conteos;
- tratamiento explícito de SE.12.

## Criterio de aceptación

verify-import.js debe devolver 12, 46, 0 y 3. La segunda importación debe actualizar sin insertar duplicados.

## Resultado aplicado

Se implementó ImportService con exceljs, upsert por código y persistencia de source_sheet, source_rows y source_transformations.
