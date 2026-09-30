# Contexto 02: actualización por hallazgos del Excel

Al inspeccionar la hoja `Servicios Externos` se confirmó que las filas físicas no equivalen a servicios: existen rangos combinados y filas de continuación. El importador debe leer el valor de la celda ancla dentro del rango, crear solo códigos distintos y conservar evidencia de la fila.

El caso `SE.12` contiene dos nombres de nivel 1 para el mismo código. Se tomó el primer nombre como canónico y se registró el segundo como observación, sin crear un segundo nivel 1.

Las filas 99–101 tienen campos incompletos. Se decidió usar `NULL` y estado `REVIEW`, no inventar valores.
