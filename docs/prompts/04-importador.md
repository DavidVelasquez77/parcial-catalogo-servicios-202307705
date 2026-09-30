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

## Prompt inicial representativo

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

`verify-import.js` debe devolver 12, 46, 0 y 3. La segunda importación debe sincronizar sin insertar duplicados: los registros modificados se actualizan y los idénticos se omiten.

## Resultado aplicado

Se implementó ImportService con exceljs, upsert por código y persistencia de source_sheet, source_rows y source_transformations.

## Prompt final

~~~xml
<prompt id="04-importador" version="final">
  <role>
    <name>Ingeniero de integración de datos y PostgreSQL</name>
    <responsibility>
      Construir una importación segura, validada, transaccional, trazable e incremental desde el Excel del catálogo.
    </responsibility>
  </role>
  <objective>
    Leer la hoja Servicios Externos, validar su contrato antes de tocar la base,
    resolver celdas combinadas, importar servicios reales y permitir reemplazar el Excel
    sin duplicar ni borrar información por accidente.
  </objective>
  <project_context>
    <source_file path="data/CatalogoServicios.xlsx" />
    <container_file path="/app/data/CatalogoServicios.xlsx" />
    <worksheet>Servicios Externos</worksheet>
    <headers range="A4:L4">
      COD.N1, SERVICIO - NIVEL 1, COD.N2, SERVICIO - NIVEL 2, ACTIVO,
      CLASE DE SERVICIO, CRITICIDAD, TIPO DE SERVICIO, DESCRIPCIÓN,
      MÉTRICA, MINIMO, MAXIMO
    </headers>
    <expected_result>
      <level_1>12</level_1>
      <level_2>46</level_2>
      <duplicates>0</duplicates>
      <review>3</review>
    </expected_result>
    <database>PostgreSQL with import_runs and import_observations</database>
    <library>ExcelJS</library>
  </project_context>
  <preflight_validation>
    <rule>El archivo debe existir y poder leerse como XLSX.</rule>
    <rule>Debe existir la hoja Servicios Externos.</rule>
    <rule>La fila 4 debe coincidir con los encabezados A4:L4.</rule>
    <rule>Debe existir un bloque de datos después de la fila 4.</rule>
    <rule>Cada COD.N2 debe tener nombre y un COD.N1 padre.</rule>
    <rule>MINIMO y MAXIMO deben ser numéricos cuando estén presentes.</rule>
    <rule>MINIMO no puede ser mayor que MAXIMO.</rule>
    <rule>Los duplicados se informan como advertencias y la primera ocurrencia es canónica.</rule>
    <rule>Si hay error estructural, no crear import_runs ni modificar servicios.</rule>
  </preflight_validation>
  <synchronization_policy>
    <case condition="code does not exist">insertar nuevo servicio</case>
    <case condition="code exists and importable fields changed">actualizar solo ese servicio</case>
    <case condition="code exists and fields are equal">omitir, contar skipped y no ejecutar UPDATE</case>
    <case condition="code appears twice in input">conservar primera ocurrencia y registrar advertencia</case>
    <case condition="code is absent from replacement file">conservar registro existente; no borrar automáticamente</case>
  </synchronization_policy>
  <transformation_rules>
    <rule>Resolver rangos combinados desde la celda master.</rule>
    <rule>Una celda secundaria combinada de COD.N2 no crea servicio.</rule>
    <rule>Convertir vacíos a NULL, nunca a cero inventado.</rule>
    <rule>Conservar el primer nombre de SE.12 y observar diferencias.</rule>
    <rule>Guardar hoja, filas y transformaciones en el registro.</rule>
    <rule>Crear REVIEW cuando faltan atributos relevantes.</rule>
    <rule>No sobrescribir responsable o sección con valores vacíos del Excel.</rule>
  </transformation_rules>
  <transaction_policy>
    <step>Validar el archivo fuera de la transacción de escritura.</step>
    <step>Crear import_run con estado RUNNING solo después del preflight.</step>
    <step>Procesar nivel 1, nivel 2, observaciones y asignaciones demo dentro de una transacción.</step>
    <step>Marcar SUCCESS con contadores al terminar.</step>
    <step>Marcar FAILED con error y revertir cambios transaccionales si ocurre una excepción.</step>
  </transaction_policy>
  <constraints>
    <constraint>No importar cada fila física como servicio.</constraint>
    <constraint>No editar el Excel original para obtener los conteos esperados.</constraint>
    <constraint>No eliminar automáticamente códigos que falten en una nueva versión.</constraint>
    <constraint>No convertir campos desconocidos en etiquetas inventadas.</constraint>
    <constraint>No crear padres duplicados para SE.12.</constraint>
    <constraint>No continuar si el contrato estructural es inválido.</constraint>
  </constraints>
  <deliverables>
    <deliverable>ImportService con validateFile y run incremental.</deliverable>
    <deliverable>Endpoint administrativo POST /api/imports/validate.</deliverable>
    <deliverable>validate-import.js, import-catalog.js y verify-import.js.</deliverable>
    <deliverable>Historial y observaciones con hoja y filas.</deliverable>
    <deliverable>Documentación para reemplazar data/CatalogoServicios.xlsx.</deliverable>
  </deliverables>
  <acceptance_criteria>
    <criterion>La validación original informa hoja Servicios Externos, 46 servicios y 51 continuaciones.</criterion>
    <criterion>La primera carga produce 12 niveles 1 y 46 niveles 2.</criterion>
    <criterion>verify-import confirma 0 duplicados y 3 servicios REVIEW.</criterion>
    <criterion>Una carga idéntica produce updated 0 y skipped 46 en una base ya cargada.</criterion>
    <criterion>Un cambio actualiza solo el código afectado.</criterion>
    <criterion>Un código nuevo se agrega.</criterion>
    <criterion>Un Excel inválido termina antes de modificar la base.</criterion>
  </acceptance_criteria>
  <validation>
    <command>docker compose exec api node apps/api/dist/scripts/validate-import.js</command>
    <command>docker compose exec api node apps/api/dist/scripts/import-catalog.js</command>
    <command>docker compose exec api node apps/api/dist/scripts/verify-import.js</command>
    <command>npm test</command>
  </validation>
  <response_format>
    Reportar contrato validado, decisiones de transformación, resumen de creados,
    actualizados, omitidos y observados, observaciones de dominio y comandos ejecutados.
  </response_format>
</prompt>
~~~

## Verificación y artefactos

- Implementación: `apps/api/src/imports/import.service.ts`.
- Endpoint: `apps/api/src/imports/import.controller.ts`.
- Documentación de operación: `docs/IMPORTACION.md`.
- Evidencia: `docs/evidencias/ciclo-harness.md`.
