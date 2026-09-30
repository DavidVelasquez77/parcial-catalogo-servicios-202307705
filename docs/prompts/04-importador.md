# Prompt 04: importador

## Objetivo

Construir una importación repetible y trazable.

## Prompt utilizado

> Implementa un importador para la hoja `Servicios Externos` usando una regla explícita para celdas combinadas. Debe conservar 12 códigos de nivel 1 y 46 de nivel 2, tratar `SE.12` con nombre canónico por primera ocurrencia, conservar valores alternativos como observación, mantener ausencias como NULL y emitir creados, actualizados, omitidos y observados. La ejecución repetida no puede duplicar.

## Criterio de aceptación

La validación debe devolver 12, 46 y cero duplicados, y registrar observaciones.
